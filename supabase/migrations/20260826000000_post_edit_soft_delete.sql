alter table public.posts
  add column if not exists edited_at timestamptz,
  add column if not exists deleted_at timestamptz;

create or replace function public.prevent_deleted_post_restore()
returns trigger language plpgsql as $$
begin
  if old.deleted_at is not null then
    new.deleted_at := old.deleted_at;
    new.is_hidden := true;
  end if;
  return new;
end;
$$;

drop trigger if exists prevent_deleted_post_restore on public.posts;
create trigger prevent_deleted_post_restore
before update on public.posts
for each row execute function public.prevent_deleted_post_restore();
