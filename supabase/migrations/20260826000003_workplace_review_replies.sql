create table if not exists public.workplace_review_replies (
  id bigint generated always as identity primary key,
  review_id bigint not null unique references public.workplace_reviews(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(trim(body)) between 10 and 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.workplace_review_replies enable row level security;
grant select on public.workplace_review_replies to anon, authenticated;
grant insert, update, delete on public.workplace_review_replies to authenticated;
grant usage, select on sequence public.workplace_review_replies_id_seq to authenticated;

create policy review_replies_public_read on public.workplace_review_replies
for select to anon, authenticated using (
  exists (select 1 from public.workplace_reviews review where review.id = review_id and review.status = 'approved')
);

create policy review_replies_director_insert on public.workplace_review_replies
for insert to authenticated with check (
  author_id = (select auth.uid()) and exists (
    select 1
    from public.workplace_reviews review
    join public.facilities facility on lower(trim(facility.name)) = lower(trim(review.facility_name))
    where review.id = review_id and review.status = 'approved'
      and facility.owner_id = (select auth.uid()) and facility.status = 'approved'
  )
);

create policy review_replies_director_update on public.workplace_review_replies
for update to authenticated using (author_id = (select auth.uid()))
with check (author_id = (select auth.uid()));

create policy review_replies_director_delete on public.workplace_review_replies
for delete to authenticated using (author_id = (select auth.uid()));
