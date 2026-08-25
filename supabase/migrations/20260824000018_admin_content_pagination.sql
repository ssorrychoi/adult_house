create or replace function public.admin_list_content(
  filter_search text default '',
  filter_type text default 'all',
  filter_visibility text default 'all',
  requested_page integer default 1,
  requested_page_size integer default 30
)
returns table (
  id bigint, kind text, title text, body text, author_id uuid, author text,
  category text, is_hidden boolean, created_at timestamptz, total_count bigint
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'admin access required'; end if;
  if filter_type not in ('all', 'post', 'comment') then raise exception 'invalid content type'; end if;
  if filter_visibility not in ('all', 'visible', 'hidden') then raise exception 'invalid visibility filter'; end if;
  if requested_page < 1 or requested_page_size < 1 or requested_page_size > 100 then raise exception 'invalid pagination'; end if;

  return query
  with combined as (
    select p.id, 'post'::text as kind, p.title, p.body, p.author_id,
      coalesce(pr.nickname, '회원') as author, coalesce(c.name, '미분류') as category,
      p.is_hidden, p.created_at
    from public.posts p
    left join public.profiles pr on pr.id = p.author_id
    left join public.categories c on c.id = p.category_id
    union all
    select cm.id, 'comment'::text as kind, coalesce(p.title, '댓글') as title, cm.body, cm.author_id,
      coalesce(pr.nickname, '회원') as author, coalesce(c.name, '미분류') as category,
      cm.is_hidden, cm.created_at
    from public.comments cm
    left join public.profiles pr on pr.id = cm.author_id
    left join public.posts p on p.id = cm.post_id
    left join public.categories c on c.id = p.category_id
  ), filtered as (
    select combined.* from combined
    where (filter_type = 'all' or combined.kind = filter_type)
      and (filter_visibility = 'all'
        or (filter_visibility = 'hidden' and combined.is_hidden)
        or (filter_visibility = 'visible' and not combined.is_hidden))
      and (coalesce(trim(filter_search), '') = ''
        or concat_ws(' ', combined.title, combined.body, combined.author, combined.author_id::text, combined.category)
          ilike '%' || trim(filter_search) || '%')
  )
  select filtered.id, filtered.kind, filtered.title, filtered.body, filtered.author_id,
    filtered.author, filtered.category, filtered.is_hidden, filtered.created_at,
    count(*) over() as total_count
  from filtered
  order by filtered.created_at desc
  limit requested_page_size offset (requested_page - 1) * requested_page_size;
end;
$$;

revoke all on function public.admin_list_content(text, text, text, integer, integer) from public;
grant execute on function public.admin_list_content(text, text, text, integer, integer) to authenticated;
