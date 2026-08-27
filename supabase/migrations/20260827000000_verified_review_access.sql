drop policy if exists reviews_member_read on public.workplace_reviews;
create policy reviews_verified_read on public.workplace_reviews
for select to authenticated using (
  author_id = (select auth.uid())
  or public.admin_can('recruitment')
  or (
    status = 'approved' and (
      exists (select 1 from public.profiles profile where profile.id = (select auth.uid()) and profile.is_verified)
      or exists (
        select 1 from public.facilities facility
        where facility.owner_id = (select auth.uid()) and facility.status = 'approved'
          and lower(trim(facility.name)) = lower(trim(workplace_reviews.facility_name))
      )
    )
  )
);

drop policy if exists review_replies_public_read on public.workplace_review_replies;
create policy review_replies_verified_read on public.workplace_review_replies
for select to authenticated using (
  public.admin_can('recruitment')
  or exists (select 1 from public.profiles profile where profile.id = (select auth.uid()) and profile.is_verified)
  or author_id = (select auth.uid())
  or exists (
    select 1
    from public.workplace_reviews review
    join public.facilities facility on lower(trim(facility.name)) = lower(trim(review.facility_name))
    where review.id = workplace_review_replies.review_id
      and facility.owner_id = (select auth.uid()) and facility.status = 'approved'
  )
);
