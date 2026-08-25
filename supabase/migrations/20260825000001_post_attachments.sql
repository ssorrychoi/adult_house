create table public.post_attachments (
  id bigint generated always as identity primary key,
  post_id bigint not null references public.posts(id) on delete cascade,
  uploader_id uuid not null references public.profiles(id) on delete cascade,
  storage_path text not null unique,
  file_name text not null,
  mime_type text not null,
  size_bytes bigint not null check(size_bytes between 1 and 10485760),
  kind text not null check(kind in ('image','resource')),
  created_at timestamptz not null default now()
);
create index post_attachments_post_idx on public.post_attachments(post_id,created_at);

alter table public.post_attachments enable row level security;
grant select on public.post_attachments to anon,authenticated;
grant insert,delete on public.post_attachments to authenticated;
grant usage,select on sequence public.post_attachments_id_seq to authenticated;

create policy post_attachments_public_read on public.post_attachments for select to anon using(
  exists(select 1 from public.posts p where p.id=post_id and p.visibility='public' and not p.is_hidden)
);
create policy post_attachments_member_read on public.post_attachments for select to authenticated using(
  exists(select 1 from public.posts p where p.id=post_id and (p.visibility in ('public','members') or p.author_id=(select auth.uid())) and not p.is_hidden)
);
create policy post_attachments_verified_insert on public.post_attachments for insert to authenticated with check(
  uploader_id=(select auth.uid())
  and exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.is_verified)
  and exists(select 1 from public.posts p where p.id=post_id and p.author_id=(select auth.uid()))
);
create policy post_attachments_delete_own on public.post_attachments for delete to authenticated using(uploader_id=(select auth.uid()));

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('post-attachments','post-attachments',false,10485760,array[
  'image/jpeg','image/png','image/webp','image/gif',
  'application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint','application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/x-hwp','application/haansofthwp','application/vnd.hancom.hwp'
]) on conflict(id) do update set file_size_limit=excluded.file_size_limit, allowed_mime_types=excluded.allowed_mime_types;

create policy post_attachment_verified_upload on storage.objects for insert to authenticated with check(
  bucket_id='post-attachments'
  and (storage.foldername(name))[1]=(select auth.uid()::text)
  and exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.is_verified)
);
create policy post_attachment_public_read on storage.objects for select to anon using(
  bucket_id='post-attachments' and exists(
    select 1 from public.post_attachments a join public.posts p on p.id=a.post_id
    where a.storage_path=name and p.visibility='public' and not p.is_hidden
  )
);
create policy post_attachment_member_read on storage.objects for select to authenticated using(
  bucket_id='post-attachments' and exists(
    select 1 from public.post_attachments a join public.posts p on p.id=a.post_id
    where a.storage_path=name and (p.visibility in ('public','members') or p.author_id=(select auth.uid())) and not p.is_hidden
  )
);
create policy post_attachment_delete_own on storage.objects for delete to authenticated using(
  bucket_id='post-attachments' and owner_id=(select auth.uid()::text)
);
