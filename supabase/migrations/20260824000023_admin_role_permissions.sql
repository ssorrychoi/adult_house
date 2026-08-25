create or replace function public.admin_can(permission_name text) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists(
    select 1 from public.admin_users
    where user_id = (select auth.uid()) and is_active and (
      role = 'super_admin'
      or (role = 'moderator' and permission_name = 'moderation')
      or (role = 'verifier' and permission_name = 'verification')
      or (role = 'recruiter' and permission_name = 'recruitment')
    )
  );
$$;
grant execute on function public.admin_can(text) to authenticated;

drop policy if exists reports_admin_read on public.reports;
drop policy if exists reports_admin_update on public.reports;
drop policy if exists posts_admin_update on public.posts;
drop policy if exists comments_admin_update on public.comments;
drop policy if exists sanctions_admin_all on public.user_sanctions;
drop policy if exists audit_admin_read on public.admin_audit_logs;
create policy reports_admin_read on public.reports for select to authenticated using(public.admin_can('moderation'));
create policy reports_admin_update on public.reports for update to authenticated using(public.admin_can('moderation')) with check(public.admin_can('moderation'));
create policy posts_admin_update on public.posts for update to authenticated using(public.admin_can('moderation')) with check(public.admin_can('moderation'));
create policy comments_admin_update on public.comments for update to authenticated using(public.admin_can('moderation')) with check(public.admin_can('moderation'));
create policy sanctions_admin_all on public.user_sanctions for all to authenticated using(public.admin_can('moderation')) with check(public.admin_can('moderation'));
create policy audit_admin_read on public.admin_audit_logs for select to authenticated using(public.admin_can('audit'));

drop policy if exists posts_member_read on public.posts;
drop policy if exists comments_member_read on public.comments;
create policy posts_member_read on public.posts for select to authenticated using(
  (not is_hidden and visibility in ('public', 'members')) or author_id = (select auth.uid()) or public.admin_can('moderation')
);
create policy comments_member_read on public.comments for select to authenticated using(
  (not is_hidden and exists(select 1 from public.posts p where p.id = post_id and p.visibility in ('public', 'members') and not p.is_hidden))
  or author_id = (select auth.uid()) or public.admin_can('moderation')
);

drop policy if exists verification_admin_read on public.teacher_verification_requests;
drop policy if exists verification_documents_admin_read on storage.objects;
create policy verification_admin_read on public.teacher_verification_requests for select to authenticated using(public.admin_can('verification'));
create policy verification_documents_admin_read on storage.objects for select to authenticated using(bucket_id = 'teacher-verifications' and public.admin_can('verification'));

drop policy if exists reviews_admin_read on public.workplace_reviews;
drop policy if exists facilities_admin_read on public.facilities;
drop policy if exists jobs_admin_read on public.jobs;
drop policy if exists facility_document_admin_read on storage.objects;
create policy reviews_admin_read on public.workplace_reviews for select to authenticated using(public.admin_can('recruitment'));
create policy facilities_admin_read on public.facilities for select to authenticated using(public.admin_can('recruitment'));
create policy jobs_admin_read on public.jobs for select to authenticated using(public.admin_can('recruitment'));
create policy facility_document_admin_read on storage.objects for select to authenticated using(bucket_id = 'facility-verifications' and public.admin_can('recruitment'));

drop policy if exists announcements_admin_read on public.announcements;
drop policy if exists announcements_admin_insert on public.announcements;
drop policy if exists announcements_admin_update on public.announcements;
drop policy if exists announcements_admin_delete on public.announcements;
create policy announcements_admin_read on public.announcements for select to authenticated using(public.admin_can('moderation'));
create policy announcements_admin_insert on public.announcements for insert to authenticated with check(public.admin_can('moderation') and created_by = (select auth.uid()));
create policy announcements_admin_update on public.announcements for update to authenticated using(public.admin_can('moderation')) with check(public.admin_can('moderation'));
create policy announcements_admin_delete on public.announcements for delete to authenticated using(public.admin_can('moderation'));

drop policy if exists announcement_image_admin_insert on storage.objects;
drop policy if exists announcement_image_admin_read on storage.objects;
drop policy if exists announcement_image_admin_delete on storage.objects;
create policy announcement_image_admin_insert on storage.objects for insert to authenticated with check(bucket_id = 'announcement-images' and public.admin_can('moderation'));
create policy announcement_image_admin_read on storage.objects for select to authenticated using(bucket_id = 'announcement-images' and public.admin_can('moderation'));
create policy announcement_image_admin_delete on storage.objects for delete to authenticated using(bucket_id = 'announcement-images' and public.admin_can('moderation'));

drop policy if exists faqs_admin_read on public.faqs;
drop policy if exists faqs_admin_insert on public.faqs;
drop policy if exists faqs_admin_update on public.faqs;
drop policy if exists faqs_admin_delete on public.faqs;
create policy faqs_admin_read on public.faqs for select to authenticated using(public.admin_can('moderation'));
create policy faqs_admin_insert on public.faqs for insert to authenticated with check(public.admin_can('moderation') and created_by = (select auth.uid()));
create policy faqs_admin_update on public.faqs for update to authenticated using(public.admin_can('moderation')) with check(public.admin_can('moderation'));
create policy faqs_admin_delete on public.faqs for delete to authenticated using(public.admin_can('moderation'));

drop policy if exists inquiries_admin_read on public.inquiries;
create policy inquiries_admin_read on public.inquiries for select to authenticated using(public.admin_can('moderation'));

create or replace function public.apply_admin_permission_guard(function_signature text, old_guard text, new_guard text)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  function_id oid;
  function_definition text;
begin
  function_id := to_regprocedure(function_signature);
  if function_id is null then return; end if;
  function_definition := pg_get_functiondef(function_id);
  if position(new_guard in function_definition) > 0 then return; end if;
  if position(old_guard in function_definition) = 0 then raise exception 'guard not found in %', function_signature; end if;
  execute replace(function_definition, old_guard, new_guard);
end;
$$;
revoke all on function public.apply_admin_permission_guard(text, text, text) from public;

select public.apply_admin_permission_guard('public.review_teacher_verification(bigint,public.verification_status,text,public.job_role,smallint)', 'if not public.is_admin() then', 'if not public.admin_can(''verification'') then');
select public.apply_admin_permission_guard('public.set_teacher_verification_active(uuid,boolean,text)', 'if not public.is_admin() then', 'if not public.admin_can(''verification'') then');
select public.apply_admin_permission_guard('public.update_teacher_career(uuid,public.job_role,smallint)', 'if not public.is_admin() then', 'if not public.admin_can(''verification'') then');
select public.apply_admin_permission_guard('public.review_workplace_review(bigint,public.review_status,text)', 'if not public.is_admin() then', 'if not public.admin_can(''recruitment'') then');
select public.apply_admin_permission_guard('public.review_facility(bigint,public.verification_status,text)', 'if not public.is_admin() then', 'if not public.admin_can(''recruitment'') then');
select public.apply_admin_permission_guard('public.answer_inquiry(bigint,text)', 'if not public.is_admin() then', 'if not public.admin_can(''moderation'') then');
select public.apply_admin_permission_guard('public.admin_list_content(text,text,text,integer,integer)', 'if not public.is_admin() then', 'if not public.admin_can(''moderation'') then');
select public.apply_admin_permission_guard('public.admin_get_content_detail(text,bigint)', 'if not public.is_admin() then', 'if not public.admin_can(''moderation'') then');
select public.apply_admin_permission_guard('public.admin_set_content_hidden(text,bigint,boolean,text)', 'if not public.is_admin() then', 'if not public.admin_can(''moderation'') then');
select public.apply_admin_permission_guard('public.admin_manage_user_sanction(uuid,text,text)', 'if not public.is_admin() then', 'if not public.admin_can(''moderation'') then');
select public.apply_admin_permission_guard('public.admin_list_audit_logs(text,text,integer,integer)', 'if not public.is_admin() then', 'if not public.admin_can(''audit'') then');
select public.apply_admin_permission_guard('public.protect_verified_teacher_fields()', 'not public.is_admin()', 'not public.admin_can(''verification'')');

drop function public.apply_admin_permission_guard(text, text, text);
