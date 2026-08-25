create or replace function public.admin_list_audit_logs(
  filter_search text default '', filter_target text default 'all',
  requested_page integer default 1, requested_page_size integer default 50
)
returns table (
  id bigint, admin_id uuid, admin_name text, action text, target_type text,
  target_id text, details jsonb, created_at timestamptz, total_count bigint
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'admin access required'; end if;
  if requested_page < 1 or requested_page_size < 1 or requested_page_size > 100 then raise exception 'invalid pagination'; end if;

  return query
  with filtered as (
    select l.id, l.admin_id, coalesce(p.nickname, '관리자') as admin_name, l.action,
      l.target_type, l.target_id, l.details, l.created_at
    from public.admin_audit_logs l
    left join public.profiles p on p.id = l.admin_id
    where (filter_target = 'all' or l.target_type = filter_target)
      and (coalesce(trim(filter_search), '') = '' or concat_ws(' ', p.nickname, l.admin_id::text,
        l.action, l.target_type, l.target_id, l.details::text) ilike '%' || trim(filter_search) || '%')
  )
  select filtered.id, filtered.admin_id, filtered.admin_name, filtered.action,
    filtered.target_type, filtered.target_id, filtered.details, filtered.created_at,
    count(*) over() as total_count
  from filtered order by filtered.created_at desc
  limit requested_page_size offset (requested_page - 1) * requested_page_size;
end;
$$;

revoke all on function public.admin_list_audit_logs(text, text, integer, integer) from public;
grant execute on function public.admin_list_audit_logs(text, text, integer, integer) to authenticated;
