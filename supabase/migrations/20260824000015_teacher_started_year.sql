alter table public.profiles
add column teacher_started_year smallint check(teacher_started_year between 1950 and 2100);

drop function if exists public.review_teacher_verification(bigint,public.verification_status,text);
drop function if exists public.review_teacher_verification(bigint,public.verification_status,text,public.job_role,public.career_band);

create function public.review_teacher_verification(
  request_id bigint,
  decision public.verification_status,
  reason text,
  selected_job_role public.job_role,
  selected_started_year smallint
) returns void
language plpgsql security definer set search_path=''
as $$
declare
  target_user uuid;
  experience_years integer;
  calculated_band public.career_band;
begin
  if not public.is_admin() then raise exception 'admin access required'; end if;
  if decision not in ('approved','rejected') then raise exception 'invalid decision'; end if;
  if decision='rejected' and (reason is null or char_length(trim(reason))<2) then raise exception 'rejection reason required'; end if;
  if decision='approved' and (selected_job_role is null or selected_started_year is null or selected_started_year<1950 or selected_started_year>extract(year from current_date)) then raise exception 'valid role and started year required'; end if;

  update public.teacher_verification_requests
  set status=decision,
      rejection_reason=case when decision='rejected' then trim(reason) else null end,
      reviewed_at=now()
  where id=request_id and status='pending'
  returning user_id into target_user;

  if target_user is null then raise exception 'pending request not found'; end if;
  if decision='approved' then
    experience_years=extract(year from current_date)::integer-selected_started_year+1;
    calculated_band=case when experience_years<=3 then '1_3'::public.career_band when experience_years<=6 then '4_6'::public.career_band else '7_plus'::public.career_band end;
    update public.profiles
    set is_verified=true, job_role=selected_job_role, teacher_started_year=selected_started_year, career_band=calculated_band, updated_at=now()
    where id=target_user;
  end if;
  insert into public.admin_audit_logs(admin_id,action,target_type,target_id,details)
  values((select auth.uid()),'verification_' || decision::text,'verification',request_id::text,
    jsonb_build_object('reason',reason,'job_role',selected_job_role,'teacher_started_year',selected_started_year));
end;
$$;
grant execute on function public.review_teacher_verification(bigint,public.verification_status,text,public.job_role,smallint) to authenticated;

create function public.protect_verified_teacher_fields() returns trigger
language plpgsql security definer set search_path=''
as $$
begin
  if old.is_verified and not public.is_admin() and (
    new.job_role is distinct from old.job_role or
    new.career_band is distinct from old.career_band or
    new.teacher_started_year is distinct from old.teacher_started_year
  ) then raise exception 'verified teacher fields are managed by admin'; end if;
  return new;
end;
$$;
create trigger profiles_protect_verified_teacher_fields
before update on public.profiles
for each row execute function public.protect_verified_teacher_fields();
