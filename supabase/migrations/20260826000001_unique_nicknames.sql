update public.profiles
set nickname = '새싹쌤-' || left(replace(id::text, '-', ''), 8)
where lower(btrim(nickname)) = lower('익명의 새싹쌤');

with duplicates as (
  select id, row_number() over (partition by lower(btrim(nickname)) order by created_at, id) as position
  from public.profiles
)
update public.profiles profile
set nickname = '새싹쌤-' || left(replace(profile.id::text, '-', ''), 8)
from duplicates
where profile.id = duplicates.id and duplicates.position > 1;

create unique index if not exists profiles_nickname_unique on public.profiles(lower(btrim(nickname)));

create or replace function public.is_nickname_available(candidate text) returns boolean
language sql stable security definer set search_path='' as $$
  select char_length(btrim(candidate)) between 2 and 20
    and not exists(
      select 1 from public.profiles
      where id <> (select auth.uid()) and lower(btrim(nickname)) = lower(btrim(candidate))
    );
$$;

grant execute on function public.is_nickname_available(text) to authenticated;

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path='' as $$
begin
  insert into public.profiles(id,nickname)
  values(new.id,'새싹쌤-' || left(replace(new.id::text, '-', ''), 8));
  return new;
end;
$$;
