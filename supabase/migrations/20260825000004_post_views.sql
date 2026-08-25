alter table public.posts add column if not exists view_count bigint not null default 0;

create table if not exists public.post_views (
  id bigint generated always as identity primary key,
  post_id bigint not null references public.posts(id) on delete cascade,
  viewer_key text not null,
  viewed_on date not null default current_date,
  created_at timestamptz not null default now(),
  unique(post_id, viewer_key, viewed_on)
);

alter table public.post_views enable row level security;
revoke all on public.post_views from anon, authenticated;

create or replace function public.record_post_view(target_post_id bigint, anonymous_id uuid default null)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  resolved_viewer_key text;
  inserted_rows integer;
  total_views bigint;
begin
  if not exists (
    select 1 from public.posts p
    where p.id = target_post_id
      and not p.is_hidden
      and (p.visibility = 'public' or current_user_id is not null)
  ) then
    raise exception 'post not found';
  end if;

  if current_user_id is null and anonymous_id is null then
    raise exception 'anonymous id is required';
  end if;

  resolved_viewer_key := coalesce(current_user_id::text, 'anonymous:' || anonymous_id::text);

  insert into public.post_views(post_id, viewer_key)
  values(target_post_id, resolved_viewer_key)
  on conflict(post_id, viewer_key, viewed_on) do nothing;

  get diagnostics inserted_rows = row_count;
  if inserted_rows = 1 then
    update public.posts set view_count = view_count + 1 where id = target_post_id;
  end if;

  select p.view_count into total_views from public.posts p where p.id = target_post_id;
  return total_views;
end;
$$;

revoke all on function public.record_post_view(bigint, uuid) from public;
grant execute on function public.record_post_view(bigint, uuid) to anon, authenticated;
