create table public.faqs (
  id bigint generated always as identity primary key,
  category text not null check(char_length(category) between 2 and 30),
  question text not null check(char_length(question) between 2 and 200),
  answer text not null check(char_length(answer) between 2 and 5000),
  sort_order smallint not null default 0,
  is_published boolean not null default false,
  created_by uuid not null references public.admin_users(user_id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.faqs enable row level security;
grant select on public.faqs to anon,authenticated;
grant insert,update,delete on public.faqs to authenticated;
create policy faqs_public_read on public.faqs for select to anon,authenticated using(is_published);
create policy faqs_admin_read on public.faqs for select to authenticated using(public.is_admin());
create policy faqs_admin_insert on public.faqs for insert to authenticated with check(public.is_admin() and created_by=(select auth.uid()));
create policy faqs_admin_update on public.faqs for update to authenticated using(public.is_admin()) with check(public.is_admin());
create policy faqs_admin_delete on public.faqs for delete to authenticated using(public.is_admin());
