create or replace function public.admin_list_accounts(filter_search text default '')
returns table(user_id uuid, email text, nickname text, role public.admin_role, is_active boolean, created_at timestamptz)
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.admin_can('audit') then raise exception 'super admin access required'; end if;
  return query
  select a.user_id, u.email::text, coalesce(p.nickname, '프로필 없음'), a.role, a.is_active, a.created_at
  from public.admin_users a
  join auth.users u on u.id = a.user_id
  left join public.profiles p on p.id = a.user_id
  where coalesce(trim(filter_search), '') = '' or concat_ws(' ', u.email, p.nickname, a.user_id::text, a.role::text)
    ilike '%' || trim(filter_search) || '%'
  order by a.is_active desc, a.created_at desc;
end;
$$;

create or replace function public.admin_save_account(target_email text, selected_role public.admin_role, active boolean default true)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  target_user uuid;
  previous_role public.admin_role;
  previous_active boolean;
begin
  if not public.admin_can('audit') then raise exception 'super admin access required'; end if;
  select id into target_user from auth.users where lower(email) = lower(trim(target_email));
  if target_user is null then raise exception '가입된 사용자를 찾을 수 없습니다'; end if;

  perform pg_advisory_xact_lock(hashtext('admin_super_admin_guard'));
  select role, is_active into previous_role, previous_active from public.admin_users where user_id = target_user;
  if target_user = (select auth.uid()) and (not active or selected_role <> previous_role) then
    raise exception '자신의 관리자 역할이나 활성 상태는 변경할 수 없습니다';
  end if;
  if previous_role = 'super_admin' and previous_active and (selected_role <> 'super_admin' or not active)
    and (select count(*) from public.admin_users where role = 'super_admin' and is_active) <= 1 then
    raise exception '마지막 최고 관리자는 변경하거나 비활성화할 수 없습니다';
  end if;

  insert into public.admin_users(user_id, role, is_active)
  values(target_user, selected_role, active)
  on conflict(user_id) do update set role = excluded.role, is_active = excluded.is_active;

  insert into public.admin_audit_logs(admin_id, action, target_type, target_id, details)
  values((select auth.uid()), 'admin_account_saved', 'admin_user', target_user::text,
    jsonb_build_object('email', lower(trim(target_email)), 'previous_role', previous_role, 'role', selected_role,
      'previous_active', previous_active, 'is_active', active));
end;
$$;

revoke all on function public.admin_list_accounts(text) from public;
revoke all on function public.admin_save_account(text,public.admin_role,boolean) from public;
grant execute on function public.admin_list_accounts(text) to authenticated;
grant execute on function public.admin_save_account(text,public.admin_role,boolean) to authenticated;
