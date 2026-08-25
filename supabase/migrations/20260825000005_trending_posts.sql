create or replace function public.get_trending_posts(result_limit integer default 3)
returns table (
  post_id bigint, author_id uuid, category text, nickname text,
  career_band text, teacher_started_year smallint, title text, body text,
  created_at timestamptz, response_wish text, view_count bigint,
  like_count bigint, comment_count bigint, recent_view_count bigint,
  popularity_score bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.author_id, coalesce(c.name, '선생님 이야기'),
    coalesce(pr.nickname, '익명의 새싹쌤'), pr.career_band::text,
    pr.teacher_started_year, p.title, p.body, p.created_at,
    p.response_wish::text, p.view_count, r.like_count, cm.comment_count,
    v.recent_view_count,
    (v.recent_view_count + r.like_count * 2 + cm.comment_count * 3)::bigint
  from public.posts p
  left join public.categories c on c.id = p.category_id
  left join public.profiles pr on pr.id = p.author_id
  left join lateral (
    select count(*)::bigint as recent_view_count
    from public.post_views pv
    where pv.post_id = p.id and pv.created_at >= now() - interval '7 days'
  ) v on true
  left join lateral (
    select count(*)::bigint as like_count
    from public.reactions reaction
    where reaction.post_id = p.id and reaction.kind = 'comfort'
  ) r on true
  left join lateral (
    select count(*)::bigint as comment_count
    from public.comments comment
    where comment.post_id = p.id and not comment.is_hidden
  ) cm on true
  where not p.is_hidden
    and (p.visibility = 'public' or auth.uid() is not null)
    and not exists(select 1 from public.post_attachments attachment where attachment.post_id = p.id)
  order by (v.recent_view_count + r.like_count * 2 + cm.comment_count * 3) desc,
    p.created_at desc
  limit least(greatest(result_limit, 1), 10);
$$;

revoke all on function public.get_trending_posts(integer) from public;
grant execute on function public.get_trending_posts(integer) to anon, authenticated;

drop function if exists public.admin_list_content(text, text, text, integer, integer);
create function public.admin_list_content(
  filter_search text default '', filter_type text default 'all',
  filter_visibility text default 'all', requested_page integer default 1,
  requested_page_size integer default 30
)
returns table (
  id bigint, kind text, title text, body text, author_id uuid, author text,
  category text, is_hidden boolean, view_count bigint,
  created_at timestamptz, total_count bigint
)
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.admin_can('moderation') then raise exception 'admin access required'; end if;
  if filter_type not in ('all', 'post', 'comment') then raise exception 'invalid content type'; end if;
  if filter_visibility not in ('all', 'visible', 'hidden') then raise exception 'invalid visibility filter'; end if;
  if requested_page < 1 or requested_page_size < 1 or requested_page_size > 100 then raise exception 'invalid pagination'; end if;

  return query
  with combined as (
    select p.id, 'post'::text as kind, p.title, p.body, p.author_id,
      coalesce(pr.nickname, '회원') as author, coalesce(c.name, '미분류') as category,
      p.is_hidden, p.view_count, p.created_at
    from public.posts p
    left join public.profiles pr on pr.id = p.author_id
    left join public.categories c on c.id = p.category_id
    union all
    select comment.id, 'comment'::text, coalesce(p.title, '댓글'), comment.body, comment.author_id,
      coalesce(pr.nickname, '회원'), coalesce(c.name, '미분류'), comment.is_hidden,
      0::bigint, comment.created_at
    from public.comments comment
    left join public.profiles pr on pr.id = comment.author_id
    left join public.posts p on p.id = comment.post_id
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
    filtered.author, filtered.category, filtered.is_hidden, filtered.view_count,
    filtered.created_at, count(*) over()
  from filtered
  order by filtered.created_at desc
  limit requested_page_size offset (requested_page - 1) * requested_page_size;
end;
$$;

revoke all on function public.admin_list_content(text, text, text, integer, integer) from public;
grant execute on function public.admin_list_content(text, text, text, integer, integer) to authenticated;

