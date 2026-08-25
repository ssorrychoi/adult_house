alter table public.announcements add column image_path text;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('announcement-images','announcement-images',false,5242880,array['image/jpeg','image/png','image/webp'])
on conflict(id) do nothing;

create policy announcement_image_admin_insert on storage.objects
for insert to authenticated with check(bucket_id='announcement-images' and public.is_admin());
create policy announcement_image_admin_read on storage.objects
for select to authenticated using(bucket_id='announcement-images' and public.is_admin());
create policy announcement_image_published_read on storage.objects
for select to anon,authenticated using(
  bucket_id='announcement-images' and exists(
    select 1 from public.announcements a where a.image_path=name and a.is_published
  )
);
create policy announcement_image_admin_delete on storage.objects
for delete to authenticated using(bucket_id='announcement-images' and public.is_admin());
