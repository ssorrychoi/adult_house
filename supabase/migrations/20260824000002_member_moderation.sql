create function public.is_suspended() returns boolean
language sql stable security definer set search_path=''
as $$
  select exists(
    select 1 from public.user_sanctions
    where user_id=(select auth.uid())
      and kind in ('suspension','permanent_ban')
      and starts_at<=now()
      and (ends_at is null or ends_at>now())
  );
$$;

drop policy posts_insert_own on public.posts;
drop policy posts_update_own on public.posts;
drop policy comments_insert_own on public.comments;
drop policy comments_update_own on public.comments;
drop policy reactions_insert_own on public.reactions;
drop policy reviews_verified_insert on public.workplace_reviews;

create policy posts_insert_own on public.posts for insert to authenticated with check(author_id=(select auth.uid()) and not public.is_suspended());
create policy posts_update_own on public.posts for update to authenticated using(author_id=(select auth.uid()) and not public.is_suspended()) with check(author_id=(select auth.uid()) and not public.is_suspended());
create policy comments_insert_own on public.comments for insert to authenticated with check(author_id=(select auth.uid()) and not public.is_suspended() and exists(select 1 from public.posts p where p.id=post_id));
create policy comments_update_own on public.comments for update to authenticated using(author_id=(select auth.uid()) and not public.is_suspended()) with check(author_id=(select auth.uid()) and not public.is_suspended());
create policy reactions_insert_own on public.reactions for insert to authenticated with check(user_id=(select auth.uid()) and not public.is_suspended());
create policy reviews_verified_insert on public.workplace_reviews for insert to authenticated with check(author_id=(select auth.uid()) and status='pending' and not public.is_suspended() and exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.is_verified));
