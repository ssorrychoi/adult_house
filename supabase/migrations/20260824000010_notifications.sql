create function public.notify_post_comment() returns trigger
language plpgsql security definer set search_path=''
as $$
declare post_author uuid;
begin
  select author_id into post_author from public.posts where id=new.post_id;
  if post_author is not null and post_author<>new.author_id then
    insert into public.notifications(user_id,kind,title,body,link)
    values(post_author,'reply','작성한 글에 새 답변이 달렸어요',left(new.body,120),'post:' || new.post_id::text);
  end if;
  return new;
end;
$$;

create trigger comments_notify_author
after insert on public.comments
for each row execute function public.notify_post_comment();

create function public.notify_post_reaction() returns trigger
language plpgsql security definer set search_path=''
as $$
declare post_author uuid;
begin
  if new.post_id is null then return new; end if;
  select author_id into post_author from public.posts where id=new.post_id;
  if post_author is not null and post_author<>new.user_id then
    insert into public.notifications(user_id,kind,title,body,link)
    values(post_author,'reaction','작성한 글에 공감이 도착했어요',null,'post:' || new.post_id::text);
  end if;
  return new;
end;
$$;

create trigger reactions_notify_author
after insert on public.reactions
for each row execute function public.notify_post_reaction();

create function public.notify_teacher_verification() returns trigger
language plpgsql security definer set search_path=''
as $$
begin
  if old.status='pending' and new.status in ('approved','rejected') then
    insert into public.notifications(user_id,kind,title,body,link)
    values(
      new.user_id,
      'verification',
      case when new.status='approved' then '선생님 인증이 완료되었어요' else '선생님 인증을 다시 확인해 주세요' end,
      case when new.status='rejected' then new.rejection_reason else '인증 배지가 프로필에 반영되었어요.' end,
      'profile'
    );
  end if;
  return new;
end;
$$;

create trigger teacher_verification_notify_user
after update of status on public.teacher_verification_requests
for each row execute function public.notify_teacher_verification();

create function public.notify_facility_verification() returns trigger
language plpgsql security definer set search_path=''
as $$
begin
  if old.status='pending' and new.status in ('approved','rejected') then
    insert into public.notifications(user_id,kind,title,body,link)
    values(
      new.owner_id,
      'system',
      case when new.status='approved' then '어린이집 인증이 완료되었어요' else '어린이집 인증을 다시 확인해 주세요' end,
      case when new.status='rejected' then new.rejection_reason else '이제 채용공고를 등록할 수 있어요.' end,
      'recruiter'
    );
  end if;
  return new;
end;
$$;

create trigger facility_verification_notify_owner
after update of status on public.facilities
for each row execute function public.notify_facility_verification();

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end;
$$;
