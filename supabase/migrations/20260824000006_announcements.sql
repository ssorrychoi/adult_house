create table public.announcements (
  id bigint generated always as identity primary key,
  title text not null check(char_length(title) between 2 and 100),
  body text not null check(char_length(body) between 2 and 5000),
  is_published boolean not null default false,
  published_at timestamptz,
  created_by uuid not null references public.admin_users(user_id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.announcements enable row level security;
grant select on public.announcements to anon,authenticated;
grant insert,update,delete on public.announcements to authenticated;

create policy announcements_public_read on public.announcements for select to anon,authenticated using(is_published);
create policy announcements_admin_read on public.announcements for select to authenticated using(public.is_admin());
create policy announcements_admin_insert on public.announcements for insert to authenticated with check(public.is_admin() and created_by=(select auth.uid()));
create policy announcements_admin_update on public.announcements for update to authenticated using(public.is_admin()) with check(public.is_admin());
create policy announcements_admin_delete on public.announcements for delete to authenticated using(public.is_admin());
