create type public.account_type as enum ('teacher','director');
alter table public.profiles add column account_type public.account_type not null default 'teacher';

create table public.facilities (
  id bigint generated always as identity primary key,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check(char_length(name) between 2 and 100),
  business_number text not null check(char_length(business_number) between 8 and 20),
  region text not null check(char_length(region) between 2 and 100),
  document_path text not null,
  status public.verification_status not null default 'pending',
  rejection_reason text check(char_length(rejection_reason)<=500),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  unique(owner_id,business_number)
);

alter table public.jobs
  add column created_by uuid references public.profiles(id) on delete set null,
  add column facility_id bigint references public.facilities(id) on delete set null,
  add column updated_at timestamptz not null default now();

alter table public.facilities enable row level security;
grant select,insert on public.facilities to authenticated;
grant insert,update,delete on public.jobs to authenticated;

create policy facilities_owner_read on public.facilities for select to authenticated using(owner_id=(select auth.uid()));
create policy facilities_owner_insert on public.facilities for insert to authenticated with check(owner_id=(select auth.uid()) and status='pending');
create policy facilities_admin_read on public.facilities for select to authenticated using(public.is_admin());
create policy jobs_director_read_own on public.jobs for select to authenticated using(created_by=(select auth.uid()));
create policy jobs_director_insert on public.jobs for insert to authenticated with check(
  created_by=(select auth.uid()) and exists(
    select 1 from public.facilities f where f.id=facility_id and f.owner_id=(select auth.uid())
      and (is_published=false or f.status='approved')
  )
);
create policy jobs_director_update on public.jobs for update to authenticated using(created_by=(select auth.uid())) with check(
  created_by=(select auth.uid()) and exists(
    select 1 from public.facilities f where f.id=facility_id and f.owner_id=(select auth.uid())
      and (is_published=false or f.status='approved')
  )
);
create policy jobs_director_delete on public.jobs for delete to authenticated using(created_by=(select auth.uid()));
create policy jobs_admin_read on public.jobs for select to authenticated using(public.is_admin());

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('facility-verifications','facility-verifications',false,5242880,array['image/jpeg','image/png','application/pdf']) on conflict(id) do nothing;
create policy facility_document_upload on storage.objects for insert to authenticated with check(bucket_id='facility-verifications' and (storage.foldername(name))[1]=(select auth.uid()::text));
create policy facility_document_owner_read on storage.objects for select to authenticated using(bucket_id='facility-verifications' and owner_id=(select auth.uid()::text));
create policy facility_document_admin_read on storage.objects for select to authenticated using(bucket_id='facility-verifications' and public.is_admin());

create function public.review_facility(facility_id bigint, decision public.verification_status, reason text default null) returns void
language plpgsql security definer set search_path=''
as $$
declare facility_owner uuid;
begin
  if not public.is_admin() then raise exception 'admin access required'; end if;
  if decision not in ('approved','rejected') then raise exception 'invalid decision'; end if;
  if decision='rejected' and (reason is null or char_length(trim(reason))<2) then raise exception 'rejection reason required'; end if;
  update public.facilities set status=decision,rejection_reason=case when decision='rejected' then trim(reason) else null end,reviewed_at=now()
  where id=facility_id and status='pending' returning owner_id into facility_owner;
  if facility_owner is null then raise exception 'pending facility not found'; end if;
  if decision='approved' then update public.profiles set account_type='director',updated_at=now() where id=facility_owner; end if;
  insert into public.admin_audit_logs(admin_id,action,target_type,target_id,details)
  values((select auth.uid()),'facility_' || decision::text,'facility',facility_id::text,jsonb_build_object('reason',reason));
end;
$$;
grant execute on function public.review_facility(bigint,public.verification_status,text) to authenticated;
