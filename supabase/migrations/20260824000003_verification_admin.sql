create policy verification_admin_read on public.teacher_verification_requests
for select to authenticated using(public.is_admin());

create policy verification_documents_admin_read on storage.objects
for select to authenticated using(bucket_id='teacher-verifications' and public.is_admin());

create function public.review_teacher_verification(
  request_id bigint,
  decision public.verification_status,
  reason text default null
) returns void
language plpgsql security definer set search_path=''
as $$
declare target_user uuid;
begin
  if not public.is_admin() then raise exception 'admin access required'; end if;
  if decision not in ('approved','rejected') then raise exception 'invalid decision'; end if;
  if decision='rejected' and (reason is null or char_length(trim(reason))<2) then raise exception 'rejection reason required'; end if;

  update public.teacher_verification_requests
  set status=decision,
      rejection_reason=case when decision='rejected' then trim(reason) else null end,
      reviewed_at=now()
  where id=request_id and status='pending'
  returning user_id into target_user;

  if target_user is null then raise exception 'pending request not found'; end if;
  update public.profiles set is_verified=(decision='approved'), updated_at=now() where id=target_user;
  insert into public.admin_audit_logs(admin_id,action,target_type,target_id,details)
  values((select auth.uid()),'verification_' || decision::text,'verification',request_id::text,jsonb_build_object('reason',reason));
end;
$$;

grant execute on function public.review_teacher_verification(bigint,public.verification_status,text) to authenticated;
