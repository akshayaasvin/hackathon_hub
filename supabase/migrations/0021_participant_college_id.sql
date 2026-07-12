-- Adds an optional FK link from a student's profile to the curated
-- `colleges` table (0015), so a match made via the registration-form
-- dropdown is traceable by id, not just by the free-text college_name.
--
-- Deliberately NOT a replacement for college_name: every existing RLS
-- policy (registrations_select_college, teams, submissions, certificates,
-- team_members — see 0001_init.sql) and the Top Performing Colleges
-- leaderboard route still match on college_name string equality. Rewiring
-- all of that to join on college_id would also require backfill-matching
-- college_profiles (the institution's own login) to a colleges row, which
-- has no reliable 1:1 name mapping today — too risky to do blind.
--
-- college_id is therefore audit/linking metadata only: populated when the
-- student picks a real match from the dropdown, left null when they use
-- the "my college isn't listed" free-text fallback, so admin can see and
-- manually link the null rows later (app/admin/colleges "Unmatched" panel).
alter table public.participant_profiles
  add column if not exists college_id uuid references public.colleges(id) on delete set null;

create index if not exists participant_profiles_college_id_idx on public.participant_profiles(college_id);

-- Backfill: link any existing profile whose free-text name matches a
-- colleges row exactly, so today's already-clean data doesn't show up as
-- "unmatched" the moment this ships.
update public.participant_profiles pp
set college_id = c.id
from public.colleges c
where pp.college_id is null
  and trim(lower(pp.college_name)) = trim(lower(c.name));
