create function public.update_teacher_career(target_user uuid, selected_job_role public.job_role, selected_started_year smallint) returns void
language plpgsql security definer set search_path=''
as $$
declare
  previous_role public.job_role;
  previous_year smallint;
  experience_years integer;
  calculated_band public.career_band;
begin
  if not public.is_admin() then raise exception 'admin access required'; end if;
  if selected_job_role is null or selected_started_year is null or selected_started_year<1950 or selected_started_year>extract(year from current_date) then raise exception 'valid role and started year required'; end if;
  select job_role,teacher_started_year into previous_role,previous_year from public.profiles where id=target_user and teacher_started_year is not null;
  if not found then raise exception 'certified teacher not found'; end if;
  experience_years=extract(year from current_date)::integer-selected_started_year+1;
  calculated_band=case when experience_years<=3 then '1_3'::public.career_band when experience_years<=6 then '4_6'::public.career_band else '7_plus'::public.career_band end;
  update public.profiles
  set job_role=selected_job_role,teacher_started_year=selected_started_year,career_band=calculated_band,updated_at=now()
  where id=target_user and teacher_started_year is not null;
  insert into public.admin_audit_logs(admin_id,action,target_type,target_id,details)
  values((select auth.uid()),'teacher_career_updated','user',target_user::text,
    jsonb_build_object('previous_job_role',previous_role,'previous_started_year',previous_year,'job_role',selected_job_role,'teacher_started_year',selected_started_year));
  insert into public.notifications(user_id,kind,title,body,link)
  values(target_user,'verification','인증 경력 정보가 변경되었어요',selected_started_year || '년 시작 · ' || experience_years || '년 차','profile');
end;
$$;
grant execute on function public.update_teacher_career(uuid,public.job_role,smallint) to authenticated;
