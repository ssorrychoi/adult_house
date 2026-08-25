create or replace function public.admin_set_content_hidden(target_type text, target_id bigint, hidden boolean, reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'admin access required'; end if;
  if target_type not in ('post', 'comment') then raise exception 'invalid content type'; end if;
  if coalesce(char_length(trim(reason)), 0) < 2 then raise exception 'reason is required'; end if;

  if target_type = 'post' then
    update public.posts set is_hidden = hidden, hidden_at = case when hidden then now() else null end where id = target_id;
  else
    update public.comments set is_hidden = hidden, hidden_at = case when hidden then now() else null end where id = target_id;
  end if;
  if not found then raise exception 'content not found'; end if;

  insert into public.admin_audit_logs(admin_id, action, target_type, target_id, details)
  values ((select auth.uid()), 'content_' || case when hidden then 'hidden' else 'restored' end, target_type, target_id::text, jsonb_build_object('reason', trim(reason)));
end;
$$;

revoke all on function public.admin_set_content_hidden(text, bigint, boolean, text) from public;
grant execute on function public.admin_set_content_hidden(text, bigint, boolean, text) to authenticated;
