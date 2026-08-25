alter table public.post_attachments
  add column if not exists moderation_reason text,
  add column if not exists download_count bigint not null default 0;

drop policy if exists post_attachments_member_read on public.post_attachments;
create policy post_attachments_member_read on public.post_attachments for select to authenticated using(
  uploader_id=(select auth.uid())
  or public.admin_can('moderation')
  or (not is_hidden and exists(select 1 from public.posts p where p.id=post_id and p.visibility in ('public','members') and not p.is_hidden))
);

drop policy if exists post_attachment_member_read on storage.objects;
create policy post_attachment_member_read on storage.objects for select to authenticated using(
  bucket_id='post-attachments' and (
    owner_id=(select auth.uid()::text) or public.admin_can('moderation') or exists(
      select 1 from public.post_attachments a join public.posts p on p.id=a.post_id
      where a.storage_path=name and not a.is_hidden and p.visibility in ('public','members') and not p.is_hidden
    )
  )
);

create or replace function public.admin_set_attachment_hidden(target_id bigint, hidden boolean, reason text)
returns void language plpgsql security definer set search_path=''
as $$
begin
  if not public.admin_can('moderation') then raise exception 'moderation access required'; end if;
  if coalesce(char_length(trim(reason)),0)<2 then raise exception 'reason is required'; end if;
  update public.post_attachments
  set is_hidden=hidden, hidden_at=case when hidden then now() else null end,
      moderation_reason=case when hidden then trim(reason) else null end
  where id=target_id;
  if not found then raise exception 'attachment not found'; end if;
  insert into public.admin_audit_logs(admin_id,action,target_type,target_id,details)
  values((select auth.uid()),'attachment_' || case when hidden then 'hidden' else 'restored' end,'attachment',target_id::text,jsonb_build_object('reason',trim(reason)));
end;
$$;

create or replace function public.record_material_download(target_id bigint)
returns void language plpgsql security definer set search_path=''
as $$
begin
  update public.post_attachments a set download_count=download_count+1
  where a.id=target_id and not a.is_hidden and exists(
    select 1 from public.posts p where p.id=a.post_id and not p.is_hidden and (
      ((select auth.uid()) is null and p.visibility='public')
      or ((select auth.uid()) is not null and p.visibility in ('public','members'))
    )
  );
end;
$$;
revoke all on function public.record_material_download(bigint) from public;
grant execute on function public.record_material_download(bigint) to anon,authenticated;
