alter table public.post_attachments
  add column if not exists is_hidden boolean not null default false,
  add column if not exists hidden_at timestamptz;

drop policy if exists post_attachments_public_read on public.post_attachments;
drop policy if exists post_attachments_member_read on public.post_attachments;
create policy post_attachments_public_read on public.post_attachments for select to anon using(
  not is_hidden and exists(select 1 from public.posts p where p.id=post_id and p.visibility='public' and not p.is_hidden)
);
create policy post_attachments_member_read on public.post_attachments for select to authenticated using(
  (not is_hidden and exists(select 1 from public.posts p where p.id=post_id and (p.visibility in ('public','members') or p.author_id=(select auth.uid())) and not p.is_hidden))
  or public.admin_can('moderation')
);
create policy post_attachments_admin_update on public.post_attachments for update to authenticated
using(public.admin_can('moderation')) with check(public.admin_can('moderation'));
grant update(is_hidden,hidden_at) on public.post_attachments to authenticated;

drop policy if exists post_attachment_public_read on storage.objects;
drop policy if exists post_attachment_member_read on storage.objects;
create policy post_attachment_public_read on storage.objects for select to anon using(
  bucket_id='post-attachments' and exists(
    select 1 from public.post_attachments a join public.posts p on p.id=a.post_id
    where a.storage_path=name and not a.is_hidden and p.visibility='public' and not p.is_hidden
  )
);
create policy post_attachment_member_read on storage.objects for select to authenticated using(
  bucket_id='post-attachments' and (
    public.admin_can('moderation') or exists(
      select 1 from public.post_attachments a join public.posts p on p.id=a.post_id
      where a.storage_path=name and not a.is_hidden and (p.visibility in ('public','members') or p.author_id=(select auth.uid())) and not p.is_hidden
    )
  )
);

create or replace function public.admin_get_content_detail(item_kind text, item_id bigint)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare resolved_post_id bigint;
begin
  if not public.admin_can('moderation') then raise exception 'moderation access required'; end if;
  if item_kind not in ('post','comment') then raise exception 'invalid content type'; end if;
  if item_kind='post' then resolved_post_id:=item_id;
  else select post_id into resolved_post_id from public.comments where id=item_id;
  end if;

  return jsonb_build_object(
    'post', (select jsonb_build_object(
      'id',p.id,'title',p.title,'body',p.body,'visibility',p.visibility,'is_hidden',p.is_hidden,
      'created_at',p.created_at,'author_id',p.author_id,'author',coalesce(pr.nickname,'회원'),'category',coalesce(c.name,'미분류')
    ) from public.posts p left join public.profiles pr on pr.id=p.author_id left join public.categories c on c.id=p.category_id where p.id=resolved_post_id),
    'attachments', (select coalesce(jsonb_agg(jsonb_build_object(
      'id',a.id,'storage_path',a.storage_path,'file_name',a.file_name,'mime_type',a.mime_type,
      'size_bytes',a.size_bytes,'kind',a.kind,'is_hidden',a.is_hidden,'created_at',a.created_at
    ) order by a.created_at),'[]'::jsonb) from public.post_attachments a where a.post_id=resolved_post_id),
    'comments', (select coalesce(jsonb_agg(jsonb_build_object(
      'id',cm.id,'body',cm.body,'parent_id',cm.parent_id,'is_hidden',cm.is_hidden,'created_at',cm.created_at,
      'author_id',cm.author_id,'author',coalesce(pr.nickname,'회원')
    ) order by cm.created_at),'[]'::jsonb) from public.comments cm left join public.profiles pr on pr.id=cm.author_id where cm.post_id=resolved_post_id)
  );
end;
$$;

create or replace function public.admin_set_attachment_hidden(target_id bigint, hidden boolean, reason text)
returns void language plpgsql security definer set search_path=''
as $$
begin
  if not public.admin_can('moderation') then raise exception 'moderation access required'; end if;
  if coalesce(char_length(trim(reason)),0)<2 then raise exception 'reason is required'; end if;
  update public.post_attachments set is_hidden=hidden, hidden_at=case when hidden then now() else null end where id=target_id;
  if not found then raise exception 'attachment not found'; end if;
  insert into public.admin_audit_logs(admin_id,action,target_type,target_id,details)
  values((select auth.uid()),'attachment_' || case when hidden then 'hidden' else 'restored' end,'attachment',target_id::text,jsonb_build_object('reason',trim(reason)));
end;
$$;

revoke all on function public.admin_set_attachment_hidden(bigint,boolean,text) from public;
grant execute on function public.admin_set_attachment_hidden(bigint,boolean,text) to authenticated;
