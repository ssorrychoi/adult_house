-- 전국 어린이집 공공데이터 저장소.
-- 출처: 한국사회보장정보원 어린이집 정보공개포털 (공공누리 제1유형)
create table public.childcare_centers (
  id bigint generated always as identity primary key,
  source_key text not null unique,
  name text not null,
  sido text not null,
  sigungu text not null,
  facility_type text not null,
  operation_status text not null,
  address text not null,
  phone text,
  latitude numeric,
  longitude numeric,
  source_updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index childcare_centers_region_idx on public.childcare_centers(sido, sigungu);
create index childcare_centers_name_idx on public.childcare_centers(lower(name));

alter table public.childcare_centers enable row level security;
grant select on public.childcare_centers to anon, authenticated;
create policy childcare_centers_public_read on public.childcare_centers
for select to anon, authenticated using (true);

comment on table public.childcare_centers is
'한국사회보장정보원 전국어린이집표준데이터 동기화 테이블. 공공누리 제1유형 출처표시 필요.';
