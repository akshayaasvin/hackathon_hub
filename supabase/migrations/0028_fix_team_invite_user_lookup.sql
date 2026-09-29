-- Phase 1 (P0): fix "User not found" on team invite.
--
-- Root cause: the invite lookup (app/participant/[hackathonId]/page.tsx handleInviteMember)
-- ran `supabase.from('users').select(...).eq('email', ...).single()` directly from the
-- BROWSER with the anon key. public.users' only SELECT policies for a non-admin caller are:
--   - users_select_own            (id = auth.uid())
--   - users_select_college_scoped (role='participant' and participant_college_matches(id))
-- participant_college_matches() checks participant_profiles.college_name = my_college_name(),
-- and my_college_name() reads FROM college_profiles — the table for role='college' ACCOUNTS,
-- not participant_profiles. For a role='participant' caller, my_college_name() is therefore
-- always null, so users_select_college_scoped can never match. A participant can never see
-- ANY other user's row via RLS, regardless of whether the invited email is correct,
-- registered, or on the same team — the client-side lookup was guaranteed to return nothing
-- for every invite, not just some. Fixed by moving the whole invite flow into a service-role
-- Route Handler (app/api/teams/[teamId]/invite/route.ts), which runs the lookup and every
-- other eligibility check (registered? approved? already on a team? team full?) server-side,
-- with the service-role client bypassing RLS entirely (deliberately — this is exactly the
-- kind of cross-user read RLS is right to block from the browser).

-- Functional index for case/whitespace-insensitive email lookups — both sides are normalized
-- with lower(trim(email)) in application code (see the route handler), so a lookup by email
-- always hits this index rather than a sequential scan.
create index if not exists users_email_lower_idx on public.users (lower(email));

-- One-time backfill: an auth.users row with no matching public.users row at all. The
-- on_auth_user_created trigger (migration 0006) closes this gap for every NEW signup from
-- the moment it was added — this only catches accounts created before that trigger existed.
-- Falls back to the same 'participant'/'pending' defaults the trigger itself uses.
do $$
declare
  backfilled_count int;
begin
  insert into public.users (id, email, role, status)
  select au.id, au.email, 'participant', 'pending'
  from auth.users au
  left join public.users u on u.id = au.id
  where u.id is null
  on conflict (id) do nothing;
  get diagnostics backfilled_count = row_count;
  raise notice 'Phase 1 backfill: created % missing public.users row(s) for pre-existing auth.users accounts.', backfilled_count;
end $$;
