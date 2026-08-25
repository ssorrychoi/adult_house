alter table public.profiles
  add column verification_revoked_at timestamptz,
  add column verification_revoked_by uuid references public.admin_users(user_id) on delete set null,
  add column verification_revoke_reason text check(char_length(verification_revoke_reason)<=500);

create function public.set_teacher_verification_active(target_user uuid, active boolean, reason text default null) returns void
language plpgsql security definer set search_path=''
as $$
begin
  if not public.is_admin() then raise exception 'admin access required'; end if;
  if not active and (reason is null or char_length(trim(reason))<2) then raise exception 'revocation reason required'; end if;
  if active then
    update public.profiles set is_verified=true,verification_revoked_at=null,verification_revoked_by=null,verification_revoke_reason=null,updated_at=now()
    where id=target_user and teacher_started_year is not null and is_verified=false;
  else
    update public.profiles set is_verified=false,verification_revoked_at=now(),verification_revoked_by=(select auth.uid()),verification_revoke_reason=trim(reason),updated_at=now()
    where id=target_user and is_verified=true;
  end if;
  if not found then raise exception 'teacher verification status not changed'; end if;
  insert into public.admin_audit_logs(admin_id,action,target_type,target_id,details)
  values((select auth.uid()),case when active then 'teacher_verification_restored' else 'teacher_verification_revoked' end,'user',target_user::text,jsonb_build_object('reason',reason));
  insert into public.notifications(user_id,kind,title,body,link)
  values(target_user,'verification',case when active then '선생님 인증이 복구되었어요' else '선생님 인증이 해제되었어요' end,case when active then '인증 권한이 다시 활성화되었어요.' else trim(reason) end,'profile');
end;
$$;
grant execute on function public.set_teacher_verification_active(uuid,boolean,text) to authenticated;
