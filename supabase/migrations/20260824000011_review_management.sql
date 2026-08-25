create function public.resubmit_workplace_review(
  review_id bigint,
  new_facility_name text,
  new_region text,
  new_facility_type text,
  new_worked_from date,
  new_worked_until date,
  new_peer_relationship smallint,
  new_workload smallint,
  new_leave_policy smallint,
  new_rating smallint,
  new_body text
) returns void
language plpgsql security definer set search_path=''
as $$
begin
  if char_length(trim(new_facility_name))<2 or char_length(trim(new_region))<2 or char_length(trim(new_facility_type))<1 then raise exception 'invalid facility information'; end if;
  if new_worked_until is not null and new_worked_until<new_worked_from then raise exception 'invalid work period'; end if;
  if new_peer_relationship not between 1 and 5 or new_workload not between 1 and 5 or new_leave_policy not between 1 and 5 or new_rating not between 1 and 5 then raise exception 'invalid rating'; end if;
  if char_length(trim(new_body)) not between 20 and 1500 then raise exception 'invalid review body'; end if;
  update public.workplace_reviews
  set facility_name=trim(new_facility_name), region=trim(new_region), facility_type=trim(new_facility_type),
      worked_from=new_worked_from, worked_until=new_worked_until,
      peer_relationship=new_peer_relationship, workload=new_workload,
      leave_policy=new_leave_policy, rating=new_rating, body=trim(new_body),
      status='pending', rejection_reason=null, reviewed_at=null
  where id=review_id and author_id=(select auth.uid()) and status='rejected';
  if not found then raise exception 'rejected review not found'; end if;
end;
$$;
grant execute on function public.resubmit_workplace_review(bigint,text,text,text,date,date,smallint,smallint,smallint,smallint,text) to authenticated;

create function public.notify_workplace_review_result() returns trigger
language plpgsql security definer set search_path=''
as $$
begin
  if old.status='pending' and new.status in ('approved','rejected') then
    insert into public.notifications(user_id,kind,title,body,link)
    values(
      new.author_id,
      'system',
      case when new.status='approved' then '어린이집 후기가 공개되었어요' else '어린이집 후기를 다시 확인해 주세요' end,
      case when new.status='rejected' then new.rejection_reason else new.facility_name || ' 후기가 관리자 심사를 통과했어요.' end,
      'my-reviews'
    );
  end if;
  return new;
end;
$$;

create trigger workplace_review_result_notify_author
after update of status on public.workplace_reviews
for each row execute function public.notify_workplace_review_result();
