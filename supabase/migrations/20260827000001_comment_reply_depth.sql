create or replace function public.validate_comment_parent() returns trigger
language plpgsql set search_path = ''
as $$
declare parent_post bigint; grandparent bigint;
begin
  if new.parent_id is null then return new; end if;
  select post_id, parent_id into parent_post, grandparent from public.comments where id = new.parent_id;
  if parent_post is null or parent_post <> new.post_id then raise exception 'invalid parent comment'; end if;
  if grandparent is not null then raise exception 'nested replies are limited to one level'; end if;
  return new;
end;
$$;

drop trigger if exists comments_validate_parent on public.comments;
create trigger comments_validate_parent before insert or update of parent_id, post_id on public.comments
for each row execute function public.validate_comment_parent();
