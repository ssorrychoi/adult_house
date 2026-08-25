create or replace function public.admin_get_content_detail(item_kind text, item_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  resolved_post_id bigint;
begin
  if not public.is_admin() then raise exception 'admin access required'; end if;
  if item_kind not in ('post', 'comment') then raise exception 'invalid content type'; end if;

  if item_kind = 'post' then
    resolved_post_id := item_id;
  else
    select post_id into resolved_post_id from public.comments where id = item_id;
  end if;

  return jsonb_build_object(
    'post', (
      select jsonb_build_object(
        'id', p.id, 'title', p.title, 'body', p.body, 'visibility', p.visibility,
        'is_hidden', p.is_hidden, 'created_at', p.created_at, 'author_id', p.author_id,
        'author', coalesce(pr.nickname, '회원'), 'category', coalesce(c.name, '미분류')
      )
      from public.posts p
      left join public.profiles pr on pr.id = p.author_id
      left join public.categories c on c.id = p.category_id
      where p.id = resolved_post_id
    ),
    'comments', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', cm.id, 'body', cm.body, 'parent_id', cm.parent_id, 'is_hidden', cm.is_hidden,
        'created_at', cm.created_at, 'author_id', cm.author_id,
        'author', coalesce(pr.nickname, '회원')
      ) order by cm.created_at), '[]'::jsonb)
      from public.comments cm
      left join public.profiles pr on pr.id = cm.author_id
      where cm.post_id = resolved_post_id
    )
  );
end;
$$;

revoke all on function public.admin_get_content_detail(text, bigint) from public;
grant execute on function public.admin_get_content_detail(text, bigint) to authenticated;
