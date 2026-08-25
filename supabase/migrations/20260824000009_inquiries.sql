create type public.inquiry_status as enum ('pending','answered','closed');
create table public.inquiries (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check(char_length(title) between 2 and 100),
  body text not null check(char_length(body) between 5 and 3000),
  status public.inquiry_status not null default 'pending',
  answer text check(char_length(answer) between 2 and 5000),
  answered_by uuid references public.admin_users(user_id),
  answered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.inquiries enable row level security;
grant select,insert on public.inquiries to authenticated;
create policy inquiries_own_read on public.inquiries for select to authenticated using(user_id=(select auth.uid()));
create policy inquiries_own_insert on public.inquiries for insert to authenticated with check(user_id=(select auth.uid()) and status='pending');
create policy inquiries_admin_read on public.inquiries for select to authenticated using(public.is_admin());

create function public.answer_inquiry(inquiry_id bigint, response text) returns void
language plpgsql security definer set search_path=''
as $$
declare target_user uuid;
begin
  if not public.is_admin() then raise exception 'admin access required'; end if;
  if response is null or char_length(trim(response))<2 then raise exception 'answer required'; end if;
  update public.inquiries set status='answered',answer=trim(response),answered_by=(select auth.uid()),answered_at=now(),updated_at=now()
  where id=inquiry_id returning user_id into target_user;
  if target_user is null then raise exception 'inquiry not found'; end if;
  insert into public.notifications(user_id,kind,title,body,link)
  values(target_user,'system','문의에 답변이 등록되었어요',left(trim(response),120),'inquiries');
  insert into public.admin_audit_logs(admin_id,action,target_type,target_id)
  values((select auth.uid()),'inquiry_answered','inquiry',inquiry_id::text);
end;
$$;
grant execute on function public.answer_inquiry(bigint,text) to authenticated;
