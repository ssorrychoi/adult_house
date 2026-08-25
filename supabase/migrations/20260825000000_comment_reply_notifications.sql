create or replace function public.notify_post_comment() returns trigger
language plpgsql security definer set search_path=''
as $$
declare
  post_author uuid;
  parent_author uuid;
begin
  select author_id into post_author from public.posts where id=new.post_id;

  if new.parent_id is not null then
    select author_id into parent_author from public.comments where id=new.parent_id;
    if parent_author is not null and parent_author<>new.author_id then
      insert into public.notifications(user_id,kind,title,body,link)
      values(parent_author,'reply','작성한 답변에 새 댓글이 달렸어요',left(new.body,120),'post:' || new.post_id::text);
    end if;
  end if;

  if post_author is not null and post_author<>new.author_id and post_author is distinct from parent_author then
    insert into public.notifications(user_id,kind,title,body,link)
    values(post_author,'reply','작성한 글에 새 답변이 달렸어요',left(new.body,120),'post:' || new.post_id::text);
  end if;
  return new;
end;
$$;
