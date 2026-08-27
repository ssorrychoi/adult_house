alter table public.workplace_reviews
  add column if not exists rejection_reason text,
  add column if not exists reviewed_at timestamptz;

create or replace function public.admin_list_workplace_reviews()
returns table(
  id bigint,
  facility_name text,
  region text,
  facility_type text,
  worked_from date,
  worked_until date,
  peer_relationship smallint,
  workload smallint,
  leave_policy smallint,
  rating smallint,
  body text,
  status public.review_status,
  rejection_reason text,
  reviewed_at timestamptz,
  created_at timestamptz,
  profiles jsonb
)
language sql stable security definer set search_path = ''
as $$
  select
    review.id,
    review.facility_name,
    review.region,
    review.facility_type,
    review.worked_from,
    review.worked_until,
    review.peer_relationship,
    review.workload,
    review.leave_policy,
    review.rating,
    review.body,
    review.status,
    review.rejection_reason,
    review.reviewed_at,
    review.created_at,
    jsonb_build_object('nickname', profile.nickname)
  from public.workplace_reviews review
  join public.profiles profile on profile.id = review.author_id
  where public.admin_can('recruitment')
  order by review.created_at desc;
$$;

revoke all on function public.admin_list_workplace_reviews() from public;
grant execute on function public.admin_list_workplace_reviews() to authenticated;

create or replace function public.review_workplace_review(
  review_id bigint,
  decision public.review_status,
  reason text default null
) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.admin_can('recruitment') then raise exception 'recruitment access required'; end if;
  if decision not in ('approved', 'rejected') then raise exception 'invalid decision'; end if;
  if decision = 'rejected' and (reason is null or char_length(trim(reason)) < 2) then raise exception 'rejection reason required'; end if;

  update public.workplace_reviews
  set status = decision,
      rejection_reason = case when decision = 'rejected' then trim(reason) else null end,
      reviewed_at = now()
  where id = review_id and status = 'pending';

  if not found then raise exception 'pending review not found'; end if;
  insert into public.admin_audit_logs(admin_id, action, target_type, target_id, details)
  values ((select auth.uid()), 'workplace_review_' || decision::text, 'workplace_review', review_id::text, jsonb_build_object('reason', reason));
end;
$$;

revoke all on function public.review_workplace_review(bigint, public.review_status, text) from public;
grant execute on function public.review_workplace_review(bigint, public.review_status, text) to authenticated;
