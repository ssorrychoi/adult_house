create unique index reports_post_reporter_unique
on public.reports(reporter_id,post_id) where post_id is not null;

create unique index reports_comment_reporter_unique
on public.reports(reporter_id,comment_id) where comment_id is not null;
