-- Fixes: infinite recursion detected in policy for relation "team_members" (Postgres 42P17).
--
-- team_members_select_own_team's "am I on the same team as this row" check queried
-- team_members from within a policy ON team_members itself. Evaluating that self-join
-- subquery re-triggers the same policy on its own inner rows, forever — this is
-- Postgres/Supabase's own documented example of the recursive-RLS-policy trap.
-- Any query that transitively touches team_members RLS (e.g. a users-table lookup that
-- evaluates participant_profiles_select_jury, which joins team_members) can 500 with
-- this error, not just direct team_members queries.
--
-- Fix: same pattern already used for is_admin()/my_college_name() — a security-definer
-- helper function whose internal query bypasses RLS (the function owner is the table
-- owner, and table owners bypass RLS by default), so the self-check can't recurse.

create or replace function public.is_in_team(target_team_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.team_members
    where team_id = target_team_id and user_id = auth.uid()
  );
$$;

drop policy if exists "team_members_select_own_team" on public.team_members;
create policy "team_members_select_own_team" on public.team_members
  for select using (
    user_id = auth.uid()
    or public.is_in_team(team_id)
  );
