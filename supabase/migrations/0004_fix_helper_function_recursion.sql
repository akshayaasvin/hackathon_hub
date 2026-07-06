-- Fixes: infinite recursion detected in policy for relation "participant_profiles" (42P17),
-- surfaced after 0003 fixed the team_members self-reference.
--
-- is_admin() and my_college_name() are security definer, which I assumed was sufficient to
-- bypass RLS on their internal queries (the standard assumption: a security-definer
-- function's queries run with the privileges of the function owner, and table owners
-- bypass RLS by default). That assumption does not hold for this project's role setup —
-- empirically, is_admin()'s internal `select ... from public.users` is still evaluating
-- public.users' own RLS policies, which re-invoke is_admin(), forever. The cycle surfaces
-- via users_select_college_scoped (users -> participant_profiles) because
-- participant_profiles_admin_all calls is_admin(), which re-queries users, which
-- re-evaluates users_select_college_scoped, and so on.
--
-- Fix: explicitly turn off row security for the duration of these functions' internal
-- queries with `set row_security = off`, rather than relying on ambient owner-bypass
-- behavior. This is the documented, unambiguous way to do this regardless of role setup.

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
set row_security = off
stable
as $$
  select exists (
    select 1 from public.users where id = auth.uid() and role = 'admin'
  );
$$;

create or replace function public.my_college_name()
returns text
language sql
security definer
set search_path = public
set row_security = off
stable
as $$
  select college_name from public.college_profiles where user_id = auth.uid();
$$;

create or replace function public.is_in_team(target_team_id uuid)
returns boolean
language sql
security definer
set search_path = public
set row_security = off
stable
as $$
  select exists (
    select 1 from public.team_members
    where team_id = target_team_id and user_id = auth.uid()
  );
$$;
