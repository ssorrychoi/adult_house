create type public.admin_role as enum ('super_admin','moderator','verifier','recruiter');
create type public.moderation_status as enum ('pending','reviewing','resolved','dismissed');
create type public.sanction_kind as enum ('warning','suspension','permanent_ban');

create table public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role public.admin_role not null default 'moderator',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create function public.is_admin() returns boolean
language sql stable security definer set search_path=''
as $$ select exists(select 1 from public.admin_users where user_id=(select auth.uid()) and is_active); $$;

alter table public.reports
  add column status public.moderation_status not null default 'pending',
  add column resolution_note text check (char_length(resolution_note)<=500),
  add column resolved_by uuid references public.admin_users(user_id),
  add column resolved_at timestamptz;

alter table public.posts add column is_hidden boolean not null default false, add column hidden_at timestamptz;
alter table public.comments add column is_hidden boolean not null default false, add column hidden_at timestamptz;

drop policy posts_public_read on public.posts;
drop policy posts_member_read on public.posts;
drop policy comments_public_read on public.comments;
drop policy comments_member_read on public.comments;
create policy posts_public_read on public.posts for select to anon using(visibility='public' and not is_hidden);
create policy posts_member_read on public.posts for select to authenticated using((not is_hidden and visibility in ('public','members')) or author_id=(select auth.uid()) or public.is_admin());
create policy comments_public_read on public.comments for select to anon using(not is_hidden and exists(select 1 from public.posts p where p.id=post_id and p.visibility='public' and not p.is_hidden));
create policy comments_member_read on public.comments for select to authenticated using((not is_hidden and exists(select 1 from public.posts p where p.id=post_id and p.visibility in ('public','members') and not p.is_hidden)) or author_id=(select auth.uid()) or public.is_admin());

create table public.user_sanctions (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind public.sanction_kind not null,
  reason text not null check (char_length(reason) between 2 and 500),
  starts_at timestamptz not null default now(), ends_at timestamptz,
  created_by uuid not null references public.admin_users(user_id), created_at timestamptz not null default now()
);

create table public.admin_audit_logs (
  id bigint generated always as identity primary key,
  admin_id uuid not null references public.admin_users(user_id),
  action text not null, target_type text not null, target_id text,
  details jsonb not null default '{}'::jsonb, created_at timestamptz not null default now()
);

alter table public.admin_users enable row level security;
alter table public.user_sanctions enable row level security;
alter table public.admin_audit_logs enable row level security;

grant select on public.admin_users to authenticated;
grant select,insert,update on public.user_sanctions,public.admin_audit_logs to authenticated;
grant update(status,resolution_note,resolved_by,resolved_at) on public.reports to authenticated;
grant update(is_hidden,hidden_at) on public.posts to authenticated;
grant update(is_hidden,hidden_at) on public.comments to authenticated;
grant usage,select on all sequences in schema public to authenticated;

create policy admin_users_read_own on public.admin_users for select to authenticated using(user_id=(select auth.uid()));
create policy reports_admin_read on public.reports for select to authenticated using(public.is_admin());
create policy reports_admin_update on public.reports for update to authenticated using(public.is_admin()) with check(public.is_admin());
create policy posts_admin_update on public.posts for update to authenticated using(public.is_admin()) with check(public.is_admin());
create policy comments_admin_update on public.comments for update to authenticated using(public.is_admin()) with check(public.is_admin());
create policy sanctions_admin_all on public.user_sanctions for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy audit_admin_read on public.admin_audit_logs for select to authenticated using(public.is_admin());
create policy audit_admin_insert on public.admin_audit_logs for insert to authenticated with check(public.is_admin() and admin_id=(select auth.uid()));
