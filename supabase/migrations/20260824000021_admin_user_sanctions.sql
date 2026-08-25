create or replace function public.admin_manage_user_sanction(target_user uuid, sanction_action text, reason text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'admin access required'; end if;
  if sanction_action not in ('warning', 'suspension', 'permanent_ban', 'lift') then raise exception 'invalid sanction action'; end if;
  if target_user = (select auth.uid()) or exists(select 1 from public.admin_users where user_id = target_user and is_active) then
    raise exception 'active admins cannot be sanctioned';
  end if;
  if sanction_action <> 'lift' and coalesce(char_length(trim(reason)), 0) < 2 then raise exception 'reason is required'; end if;

  if sanction_action = 'lift' then
    update public.user_sanctions set ends_at = now()
    where user_id = target_user and kind in ('suspension', 'permanent_ban') and (ends_at is null or ends_at > now());
  else
    insert into public.user_sanctions(user_id, kind, reason, ends_at, created_by)
    values (target_user, sanction_action::public.sanction_kind, trim(reason),
      case when sanction_action = 'suspension' then now() + interval '7 days' else null end,
      (select auth.uid()));
  end if;

  insert into public.admin_audit_logs(admin_id, action, target_type, target_id, details)
  values ((select auth.uid()), 'member_' || sanction_action, 'user', target_user::text, jsonb_build_object('reason', reason));
end;
$$;

revoke all on function public.admin_manage_user_sanction(uuid, text, text) from public;
grant execute on function public.admin_manage_user_sanction(uuid, text, text) to authenticated;
