-- 선생잎 MVP: 공개 열람, 로그인 작성, 인증 회원만 어린이집 후기 작성.
create type public.job_role as enum ('childcare_teacher','special_education_teacher','kindergarten_teacher','other');
create type public.career_band as enum ('under_1','1_3','4_6','7_plus');
create type public.post_visibility as enum ('public','members');
create type public.response_wish as enum ('comfort','experience','advice','resources');
create type public.reaction_kind as enum ('comfort','helpful');
create type public.verification_status as enum ('pending','approved','rejected');
create type public.review_status as enum ('pending','approved','rejected');
create type public.employment_type as enum ('permanent','contract','part_time','substitute');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nickname text not null default '익명의 새싹쌤' check (char_length(nickname) between 2 and 20),
  job_role public.job_role,
  career_band public.career_band,
  is_verified boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.categories (
  id bigint generated always as identity primary key,
  parent_id bigint references public.categories(id), slug text not null unique,
  name text not null, sort_order smallint not null default 0, is_active boolean not null default true
);
create table public.posts (
  id bigint generated always as identity primary key,
  author_id uuid not null references public.profiles(id) on delete cascade,
  category_id bigint not null references public.categories(id),
  title text not null check (char_length(title) between 2 and 60),
  body text not null check (char_length(body) between 10 and 2000),
  visibility public.post_visibility not null default 'members', response_wish public.response_wish,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.comments (
  id bigint generated always as identity primary key,
  post_id bigint not null references public.posts(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  parent_id bigint references public.comments(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.reactions (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  post_id bigint references public.posts(id) on delete cascade,
  comment_id bigint references public.comments(id) on delete cascade,
  kind public.reaction_kind not null, created_at timestamptz not null default now(),
  constraint one_reaction_target check (num_nonnulls(post_id,comment_id)=1)
);
create unique index reactions_post_unique on public.reactions(user_id,post_id,kind) where post_id is not null;
create unique index reactions_comment_unique on public.reactions(user_id,comment_id,kind) where comment_id is not null;
create table public.bookmarks (
  user_id uuid not null references public.profiles(id) on delete cascade,
  post_id bigint not null references public.posts(id) on delete cascade,
  created_at timestamptz not null default now(), primary key(user_id,post_id)
);
create table public.jobs (
  id bigint generated always as identity primary key,
  facility_name text not null, region text not null,
  title text not null check (char_length(title) between 2 and 100), description text not null,
  job_role public.job_role not null, employment_type public.employment_type not null,
  apply_url text, closes_at date, is_published boolean not null default false,
  created_at timestamptz not null default now()
);
create table public.saved_jobs (
  user_id uuid not null references public.profiles(id) on delete cascade,
  job_id bigint not null references public.jobs(id) on delete cascade,
  created_at timestamptz not null default now(), primary key(user_id,job_id)
);
create table public.teacher_verification_requests (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  method text not null check (method in ('certificate','employment')),
  document_path text not null, status public.verification_status not null default 'pending',
  rejection_reason text, created_at timestamptz not null default now(), reviewed_at timestamptz
);
create unique index one_pending_verification on public.teacher_verification_requests(user_id) where status='pending';
create table public.workplace_reviews (
  id bigint generated always as identity primary key,
  author_id uuid not null references public.profiles(id) on delete cascade,
  facility_name text not null, region text not null, facility_type text not null,
  worked_from date not null, worked_until date,
  peer_relationship smallint not null check (peer_relationship between 1 and 5),
  workload smallint not null check (workload between 1 and 5),
  leave_policy smallint not null check (leave_policy between 1 and 5),
  rating smallint not null check (rating between 1 and 5),
  body text not null check (char_length(body) between 20 and 1500),
  status public.review_status not null default 'pending', created_at timestamptz not null default now()
);
create table public.notifications (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('reply','reaction','verification','system')),
  title text not null, body text, link text, read_at timestamptz, created_at timestamptz not null default now()
);
create table public.reports (
  id bigint generated always as identity primary key,
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  post_id bigint references public.posts(id) on delete cascade,
  comment_id bigint references public.comments(id) on delete cascade,
  reason text not null check (reason in ('privacy','abuse','spam','false_information','other')),
  details text check (char_length(details)<=500), created_at timestamptz not null default now(),
  constraint one_report_target check (num_nonnulls(post_id,comment_id)=1)
);
create table public.blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(), primary key(blocker_id,blocked_id), check(blocker_id<>blocked_id)
);

create index posts_feed_idx on public.posts(category_id,created_at desc);
create index posts_author_idx on public.posts(author_id,created_at desc);
create index comments_post_idx on public.comments(post_id,created_at);
create index notifications_user_idx on public.notifications(user_id,created_at desc);
create index jobs_feed_idx on public.jobs(is_published,created_at desc);
create index reviews_feed_idx on public.workplace_reviews(status,created_at desc);

create function public.set_updated_at() returns trigger language plpgsql set search_path='' as $$ begin new.updated_at=now(); return new; end; $$;
create trigger profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger posts_updated_at before update on public.posts for each row execute function public.set_updated_at();
create trigger comments_updated_at before update on public.comments for each row execute function public.set_updated_at();
create function public.handle_new_user() returns trigger language plpgsql security definer set search_path='' as $$ begin insert into public.profiles(id) values(new.id); return new; end; $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

insert into public.categories(slug,name,sort_order) values
('teacher-stories','선생님 이야기',10),('work-help','업무 도움',20),('career','커리어',30),('expert-qa','전문가 Q&A',40);
insert into public.categories(parent_id,slug,name,sort_order)
select id,v.slug,v.name,v.ord from public.categories p cross join (values
('director-colleagues','원장·동료',11),('parents','학부모 관계',12),('work-treatment','업무·처우',13),('burnout','퇴사·번아웃',14)) v(slug,name,ord) where p.slug='teacher-stories'
union all select id,v.slug,v.name,v.ord from public.categories p cross join (values
('play-classes','놀이·수업',21),('events','행사 준비',22),('daily-records','관찰일지·알림장',23),('parent-counseling','학부모 상담',24),('evaluation-admin','평가제·행정',25),('special-care','특수보육',26)) v(slug,name,ord) where p.slug='work-help'
union all select id,v.slug,v.name,v.ord from public.categories p cross join (values
('jobs','채용정보',31),('workplace-reviews','어린이집 후기',32),('interview-reviews','면접 후기',33),('job-change','이직 고민',34),('licenses-training','자격·교육',35)) v(slug,name,ord) where p.slug='career'
union all select id,v.slug,v.name,v.ord from public.categories p cross join (values
('contracts-pay','근로계약·급여',41),('breaks-leave','휴게시간·연차',42),('workplace-harassment','직장 내 괴롭힘',43),('child-abuse-response','아동학대 대응',44),('other-legal','기타 법률상담',45)) v(slug,name,ord) where p.slug='expert-qa';

alter table public.profiles enable row level security; alter table public.categories enable row level security;
alter table public.posts enable row level security; alter table public.comments enable row level security;
alter table public.reactions enable row level security; alter table public.bookmarks enable row level security;
alter table public.jobs enable row level security; alter table public.saved_jobs enable row level security;
alter table public.teacher_verification_requests enable row level security; alter table public.workplace_reviews enable row level security;
alter table public.notifications enable row level security; alter table public.reports enable row level security; alter table public.blocks enable row level security;

revoke all on all tables in schema public from anon,authenticated;
grant select on public.categories,public.profiles,public.posts,public.comments,public.reactions,public.jobs to anon,authenticated;
grant update(nickname,job_role,career_band) on public.profiles to authenticated;
grant insert,update,delete on public.posts,public.comments to authenticated;
grant insert,delete on public.reactions,public.bookmarks,public.saved_jobs,public.blocks to authenticated;
grant select on public.bookmarks,public.saved_jobs,public.blocks to authenticated;
grant insert,select on public.teacher_verification_requests to authenticated;
grant insert,select,update,delete on public.workplace_reviews to authenticated;
grant select,update,delete on public.notifications to authenticated;
grant insert,select on public.reports to authenticated;
grant usage,select on all sequences in schema public to authenticated;

create policy profiles_read on public.profiles for select to anon,authenticated using(true);
create policy profiles_update_own on public.profiles for update to authenticated using((select auth.uid())=id) with check((select auth.uid())=id);
create policy categories_read on public.categories for select to anon,authenticated using(is_active);
create policy posts_public_read on public.posts for select to anon using(visibility='public');
create policy posts_member_read on public.posts for select to authenticated using(visibility in ('public','members') or author_id=(select auth.uid()));
create policy posts_insert_own on public.posts for insert to authenticated with check(author_id=(select auth.uid()));
create policy posts_update_own on public.posts for update to authenticated using(author_id=(select auth.uid())) with check(author_id=(select auth.uid()));
create policy posts_delete_own on public.posts for delete to authenticated using(author_id=(select auth.uid()));
create policy comments_public_read on public.comments for select to anon using(exists(select 1 from public.posts p where p.id=post_id and p.visibility='public'));
create policy comments_member_read on public.comments for select to authenticated using(exists(select 1 from public.posts p where p.id=post_id and p.visibility in ('public','members')));
create policy comments_insert_own on public.comments for insert to authenticated with check(author_id=(select auth.uid()) and exists(select 1 from public.posts p where p.id=post_id));
create policy comments_update_own on public.comments for update to authenticated using(author_id=(select auth.uid())) with check(author_id=(select auth.uid()));
create policy comments_delete_own on public.comments for delete to authenticated using(author_id=(select auth.uid()));
create policy reactions_read on public.reactions for select to anon,authenticated using(true);
create policy reactions_insert_own on public.reactions for insert to authenticated with check(user_id=(select auth.uid()));
create policy reactions_delete_own on public.reactions for delete to authenticated using(user_id=(select auth.uid()));
create policy bookmarks_own on public.bookmarks for select to authenticated using(user_id=(select auth.uid()));
create policy bookmarks_insert_own on public.bookmarks for insert to authenticated with check(user_id=(select auth.uid()));
create policy bookmarks_delete_own on public.bookmarks for delete to authenticated using(user_id=(select auth.uid()));
create policy jobs_published_read on public.jobs for select to anon,authenticated using(is_published);
create policy saved_jobs_own on public.saved_jobs for select to authenticated using(user_id=(select auth.uid()));
create policy saved_jobs_insert_own on public.saved_jobs for insert to authenticated with check(user_id=(select auth.uid()));
create policy saved_jobs_delete_own on public.saved_jobs for delete to authenticated using(user_id=(select auth.uid()));
create policy verification_own_read on public.teacher_verification_requests for select to authenticated using(user_id=(select auth.uid()));
create policy verification_own_insert on public.teacher_verification_requests for insert to authenticated with check(user_id=(select auth.uid()) and status='pending');
create policy reviews_member_read on public.workplace_reviews for select to authenticated using(status='approved' or author_id=(select auth.uid()));
create policy reviews_verified_insert on public.workplace_reviews for insert to authenticated with check(author_id=(select auth.uid()) and status='pending' and exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.is_verified));
create policy reviews_own_pending_update on public.workplace_reviews for update to authenticated using(author_id=(select auth.uid()) and status='pending') with check(author_id=(select auth.uid()) and status='pending');
create policy reviews_own_delete on public.workplace_reviews for delete to authenticated using(author_id=(select auth.uid()));
create policy notifications_own_read on public.notifications for select to authenticated using(user_id=(select auth.uid()));
create policy notifications_own_update on public.notifications for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create policy notifications_own_delete on public.notifications for delete to authenticated using(user_id=(select auth.uid()));
create policy reports_own_read on public.reports for select to authenticated using(reporter_id=(select auth.uid()));
create policy reports_own_insert on public.reports for insert to authenticated with check(reporter_id=(select auth.uid()));
create policy blocks_own_read on public.blocks for select to authenticated using(blocker_id=(select auth.uid()));
create policy blocks_own_insert on public.blocks for insert to authenticated with check(blocker_id=(select auth.uid()));
create policy blocks_own_delete on public.blocks for delete to authenticated using(blocker_id=(select auth.uid()));

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('teacher-verifications','teacher-verifications',false,5242880,array['image/jpeg','image/png','application/pdf']) on conflict(id) do nothing;
create policy verification_upload_own on storage.objects for insert to authenticated with check(bucket_id='teacher-verifications' and (storage.foldername(name))[1]=(select auth.uid()::text));
create policy verification_read_own on storage.objects for select to authenticated using(bucket_id='teacher-verifications' and owner_id=(select auth.uid()::text));
create policy verification_delete_own on storage.objects for delete to authenticated using(bucket_id='teacher-verifications' and owner_id=(select auth.uid()::text));
