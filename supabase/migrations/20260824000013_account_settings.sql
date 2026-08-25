create table public.notification_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  replies boolean not null default true,
  reactions boolean not null default true,
  verification boolean not null default true,
  service boolean not null default true,
  updated_at timestamptz not null default now()
);
alter table public.notification_preferences enable row level security;
grant select,insert,update on public.notification_preferences to authenticated;
create policy notification_preferences_own_read on public.notification_preferences for select to authenticated using(user_id=(select auth.uid()));
create policy notification_preferences_own_insert on public.notification_preferences for insert to authenticated with check(user_id=(select auth.uid()));
create policy notification_preferences_own_update on public.notification_preferences for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));

create function public.filter_notification_preference() returns trigger
language plpgsql security definer set search_path=''
as $$
declare allowed boolean;
begin
  select case new.kind
    when 'reply' then replies
    when 'reaction' then reactions
    when 'verification' then verification
    else service
  end into allowed
  from public.notification_preferences where user_id=new.user_id;
  if allowed=false then return null; end if;
  return new;
end;
$$;
create trigger notifications_respect_preferences
before insert on public.notifications
for each row execute function public.filter_notification_preference();

create function public.delete_my_account() returns void
language plpgsql security definer set search_path=''
as $$
begin
  delete from auth.users where id=(select auth.uid());
  if not found then raise exception 'user not found'; end if;
end;
$$;
revoke all on function public.delete_my_account() from public;
grant execute on function public.delete_my_account() to authenticated;
