-- Reference table of institutions for the registration-form dropdown
-- (item 5). Deliberately NOT a foreign key target for participant_profiles/
-- college_profiles/college_applications.college_name — those stay free
-- text so existing data and the Top Performing Colleges leaderboard query
-- (app/api/college/leaderboard/route.ts, matches purely on college_name
-- string equality) keep working unchanged. This table is just the curated
-- list of options the dropdown offers, plus an "Other" free-text fallback
-- that also writes into the same college_name text columns.

create table public.colleges (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  district text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index colleges_name_idx on public.colleges(name);

alter table public.colleges enable row level security;

-- Public read: the registration form's dropdown must be usable by a
-- not-yet-authenticated visitor (anon role), same pattern as "announcements".
create policy "colleges_select_all" on public.colleges
  for select using (true);
create policy "colleges_admin_all" on public.colleges
  for all using (is_admin()) with check (is_admin());

-- Backfill from whatever college names already exist in the wild, so the
-- dropdown isn't empty on day one and existing free-text entries have a
-- matching option instead of every current student falling into "Other".
insert into public.colleges (name)
select distinct trim(college_name)
from (
  select college_name from public.participant_profiles where college_name is not null and trim(college_name) <> ''
  union
  select college_name from public.college_profiles where college_name is not null and trim(college_name) <> ''
) all_names
on conflict (name) do nothing;
