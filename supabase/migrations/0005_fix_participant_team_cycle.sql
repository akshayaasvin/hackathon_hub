-- Fixes the actual recursion cycle (confirmed via diagnostic: postgres owns every
-- table/function here and has rolbypassrls=true, so is_admin()/my_college_name()/
-- is_in_team() were never the problem — they already bypass RLS correctly).
--
-- The real cycle is a direct two-table loop that never went through a security-definer
-- function at all:
--   participant_profiles_select_jury  raw-queries team_members
--   team_members_select_college       raw-queries participant_profiles right back
-- Neither subquery is wrapped in a security-definer function, so neither gets the
-- postgres-owner RLS bypass — each executes as the calling `authenticated` role and
-- re-triggers the other table's policies, forever.
--
-- Fix: wrap every raw cross-table check that touches team_members/participant_profiles
-- in a security-definer helper (same proven pattern as is_admin()), so none of these
-- policies contain a raw subquery into either table anymore.

create or replace function public.participant_college_matches(target_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.participant_profiles
    where user_id = target_user_id and college_name = public.my_college_name()
  );
$$;

create or replace function public.is_assigned_jury_for_participant(target_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.judge_assignments ja
    join public.team_members tm on tm.team_id = ja.team_id
    where ja.judge_id = auth.uid() and tm.user_id = target_user_id
  );
$$;

create or replace function public.team_has_member_from_my_college(target_team_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.team_members tm
    join public.participant_profiles pp on pp.user_id = tm.user_id
    where tm.team_id = target_team_id and pp.college_name = public.my_college_name()
  );
$$;

-- users: was a raw exists() into participant_profiles. Not part of the tight cycle
-- itself, but rewritten for consistency now that a wrapper exists for this exact check.
drop policy if exists "users_select_college_scoped" on public.users;
create policy "users_select_college_scoped" on public.users
  for select using (
    role = 'participant' and public.participant_college_matches(id)
  );

-- participant_profiles: this was one half of the cycle (raw-queried team_members).
drop policy if exists "participant_profiles_select_jury" on public.participant_profiles;
create policy "participant_profiles_select_jury" on public.participant_profiles
  for select using (public.is_assigned_jury_for_participant(user_id));

-- team_members: this was the other half of the cycle (raw-queried participant_profiles).
drop policy if exists "team_members_select_college" on public.team_members;
create policy "team_members_select_college" on public.team_members
  for select using (public.participant_college_matches(user_id));

-- teams / submissions: same "does this team have a member from my college" shape,
-- rewritten for consistency so no policy anywhere still raw-joins team_members +
-- participant_profiles together.
drop policy if exists "teams_select_college" on public.teams;
create policy "teams_select_college" on public.teams
  for select using (public.team_has_member_from_my_college(id));

drop policy if exists "submissions_select_college" on public.submissions;
create policy "submissions_select_college" on public.submissions
  for select using (public.team_has_member_from_my_college(team_id));

-- registrations / certificates: same "is this row's user in my college" shape.
drop policy if exists "registrations_select_college" on public.registrations;
create policy "registrations_select_college" on public.registrations
  for select using (public.participant_college_matches(user_id));

drop policy if exists "certificates_select_college" on public.certificates;
create policy "certificates_select_college" on public.certificates
  for select using (public.participant_college_matches(user_id));
