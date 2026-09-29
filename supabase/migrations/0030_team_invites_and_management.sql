-- Phase 3 (P1): pending team invites + team management actions.
--
-- Note on sequencing: Phase 3's "before the Round 1 deadline" lock needs a deadline column
-- that Phase 4's own data model formally introduces (round1_deadline). Since Phase 3
-- genuinely depends on it, it's added here (idempotent — Phase 4's migration also uses
-- `add column if not exists` and does not re-declare it).
alter table public.hackathons add column if not exists round1_deadline timestamptz;

-- ── team_invites: pending records, not instant adds ─────────────────────────────────────
create table if not exists public.team_invites (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  hackathon_id uuid not null references public.hackathons(id) on delete cascade,
  invited_user_id uuid not null references public.users(id) on delete cascade,
  invited_by uuid not null references public.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'revoked')),
  created_at timestamptz not null default now(),
  responded_at timestamptz
);
create index if not exists team_invites_team_id_idx on public.team_invites (team_id);
create index if not exists team_invites_invited_user_id_idx on public.team_invites (invited_user_id);

-- Only one PENDING invite per (team, user) at a time — re-inviting after a decline/revoke is
-- fine (a fresh row), but the same open invite can't be sent twice.
create unique index if not exists team_invites_one_pending_per_team_user
  on public.team_invites (team_id, invited_user_id)
  where status = 'pending';

alter table public.team_invites enable row level security;

create or replace function public.is_team_lead(target_team_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (select 1 from public.teams where id = target_team_id and team_lead_id = auth.uid());
$$;

-- Invitee reads their own invites (Dashboard + notification bell); the team leader reads
-- invites for their own team (Manage Team modal's "pending" list). No insert/update/delete
-- policy for `authenticated` at all — every write (send/accept/decline/revoke) goes through a
-- service-role route that re-validates eligibility, leader role, and deadlines first.
drop policy if exists "team_invites_select_own" on public.team_invites;
create policy "team_invites_select_own" on public.team_invites
  for select using (invited_user_id = auth.uid() or public.is_team_lead(team_id));
drop policy if exists "team_invites_admin_all" on public.team_invites;
create policy "team_invites_admin_all" on public.team_invites
  for all using (is_admin()) with check (is_admin());

-- ── team_members: lock direct client writes now that every path (create, invite-accept,
--     remove, leave, disband) goes through a service-role route — same reasoning, and same
--     pattern, as migration 0011's revoke on teams/submissions. The route layer is what now
--     enforces "only leader can invite/remove/disband" and the Round 1 deadline lock; RLS
--     alone (team_members_insert/_delete, still granted) could no longer be trusted to since
--     it doesn't know about pending invites, leadership transfer, or deadlines at all.
revoke insert, delete on public.team_members from authenticated;

-- teams: transferring leadership updates team_lead_id, which teams_update_lead (RLS) already
-- allows the CURRENT leader to do — but that would let a leader "transfer" to a non-member.
-- Moved server-side instead (app/api/teams/[teamId]/transfer-leadership) for the same
-- membership-validation reason, so lock this down too rather than leave a narrower RLS hole.
revoke update on public.teams from authenticated;
