alter table public.workplace_reviews
  add column rejection_reason text check (char_length(rejection_reason)<=500),
  add column reviewed_at timestamptz;

create policy reviews_admin_read on public.workplace_reviews
for select to authenticated using(public.is_admin());

create function public.review_workplace_review(
  review_id bigint,
  decision public.review_status,
  reason text default null
) returns void
language plpgsql security definer set search_path=''
as $$
begin
  if not public.is_admin() then raise exception 'admin access required'; end if;
  if decision not in ('approved','rejected') then raise exception 'invalid decision'; end if;
  if decision='rejected' and (reason is null or char_length(trim(reason))<2) then raise exception 'rejection reason required'; end if;

  update public.workplace_reviews
  set status=decision,
      rejection_reason=case when decision='rejected' then trim(reason) else null end,
      reviewed_at=now()
  where id=review_id and status='pending';

  if not found then raise exception 'pending review not found'; end if;
  insert into public.admin_audit_logs(admin_id,action,target_type,target_id,details)
  values((select auth.uid()),'workplace_review_' || decision::text,'workplace_review',review_id::text,jsonb_build_object('reason',reason));
end;
$$;

grant execute on function public.review_workplace_review(bigint,public.review_status,text) to authenticated;
