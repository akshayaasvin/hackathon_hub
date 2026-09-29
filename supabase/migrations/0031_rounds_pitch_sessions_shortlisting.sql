-- Phase 4 (P1): Round 1 (PPT + pitch) -> Shortlist -> Round 2 (demo) -> Winners.

-- ── hackathons: round deadlines + publish flags (round1_deadline already added in 0030,
--     idempotent here too since Phase 4's own spec names it) ──
alter table public.hackathons add column if not exists round1_deadline timestamptz;
alter table public.hackathons add column if not exists round2_deadline timestamptz;
alter table public.hackathons add column if not exists results_published_round1 boolean not null default false;
alter table public.hackathons add column if not exists results_published_final boolean not null default false;

-- ── submissions: round-aware, presentation LINK instead of an uploaded file ──
-- "presentation_url instead of ppt_path" (task's own wording) — this project's existing
-- column for that is ppt_url (never ppt_path, and never a Storage path to begin with), so
-- there's nothing to migrate away from; presentation_url is added fresh for Round 1 and is
-- the ONLY field Round 1 writes. ppt_url/report_pdf_url stay as-is for any pre-existing
-- generic (pre-rounds) submission; Round 2 uses the new live_demo_url + notes alongside the
-- already-existing repo_link (github) and demo_video_url (optional demo video).
alter table public.submissions add column if not exists round int not null default 1 check (round in (1, 2));
alter table public.submissions add column if not exists presentation_url text;
alter table public.submissions add column if not exists live_demo_url text;
alter table public.submissions add column if not exists notes text;

-- One submission per team PER ROUND, replacing the old one-ever unique(team_id) — a team now
-- has (up to) two rows, one per round, each independently upsertable.
alter table public.submissions drop constraint if exists submissions_team_id_key;
create unique index if not exists submissions_team_id_round_uniq on public.submissions (team_id, round);

-- ── team_round_status: shortlist / attendance / score / position per team per round ──
create table if not exists public.team_round_status (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  hackathon_id uuid not null references public.hackathons(id) on delete cascade,
  round int not null check (round in (1, 2)),
  shortlisted boolean not null default false,
  attendance text check (attendance in ('scheduled', 'presented', 'absent')), -- Round 1 pitch only
  score numeric,
  remarks text,
  position int, -- 1st/2nd/3rd/... ; null = no placement
  special_mention boolean not null default false,
  scored_by uuid references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (team_id, round)
);
create index if not exists team_round_status_hackathon_round_idx on public.team_round_status (hackathon_id, round);

alter table public.team_round_status enable row level security;

-- Participants: read-only, and ONLY once the admin has published that round's results —
-- "Before publish, participants must not see status" is enforced here, not just hidden by the
-- UI, so a team member reading team_round_status directly still sees nothing pre-publish.
drop policy if exists "team_round_status_select_published_team" on public.team_round_status;
create policy "team_round_status_select_published_team" on public.team_round_status
  for select using (
    (
      (round = 1 and exists (select 1 from public.hackathons h where h.id = hackathon_id and h.results_published_round1))
      or (round = 2 and exists (select 1 from public.hackathons h where h.id = hackathon_id and h.results_published_final))
    )
    and exists (select 1 from public.team_members tm where tm.team_id = public.team_round_status.team_id and tm.user_id = auth.uid())
  );

-- Judges assigned to a team can always read its status (they need to see prior scores while
-- scoring), but writes go through a service-role route (see app/api/admin/**), same reasoning
-- as every other cross-role write in this schema (teams, team_members, submissions) — a judge
-- session doesn't get to insert/update this table directly, so "publish" can never be flipped
-- by anyone but an admin route, and a judge's own score can't retroactively rewrite a
-- teammate's shortlist without going through validated server logic.
drop policy if exists "team_round_status_select_jury" on public.team_round_status;
create policy "team_round_status_select_jury" on public.team_round_status
  for select using (
    exists (select 1 from public.judge_assignments ja where ja.team_id = public.team_round_status.team_id and ja.judge_id = auth.uid())
  );

drop policy if exists "team_round_status_admin_all" on public.team_round_status;
create policy "team_round_status_admin_all" on public.team_round_status
  for all using (is_admin()) with check (is_admin());

-- ── pitch_sessions / pitch_slots (Round 1 live pitch scheduling) ──
create table if not exists public.pitch_sessions (
  id uuid primary key default gen_random_uuid(),
  hackathon_id uuid not null references public.hackathons(id) on delete cascade,
  title text not null,
  meet_url text not null check (meet_url like 'https://meet.google.com/%'),
  starts_at timestamptz not null,
  duration_minutes int not null check (duration_minutes > 0),
  notes text,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists pitch_sessions_hackathon_id_idx on public.pitch_sessions (hackathon_id);

create table if not exists public.pitch_slots (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.pitch_sessions(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  slot_time timestamptz,
  status text not null default 'scheduled' check (status in ('scheduled', 'presented', 'absent')),
  invite_sent_at timestamptz,
  created_at timestamptz not null default now(),
  unique (session_id, team_id)
);
create index if not exists pitch_slots_session_id_idx on public.pitch_slots (session_id);
create index if not exists pitch_slots_team_id_idx on public.pitch_slots (team_id);

alter table public.pitch_sessions enable row level security;
alter table public.pitch_slots enable row level security;

-- Participants read only their own team's slot/session (never another team's), and only once
-- their team has actually been invited (invite_sent_at is set) — before that, the session may
-- still be a draft the admin is editing.
drop policy if exists "pitch_slots_select_own_team" on public.pitch_slots;
create policy "pitch_slots_select_own_team" on public.pitch_slots
  for select using (
    invite_sent_at is not null
    and exists (select 1 from public.team_members tm where tm.team_id = public.pitch_slots.team_id and tm.user_id = auth.uid())
  );
drop policy if exists "pitch_slots_admin_all" on public.pitch_slots;
create policy "pitch_slots_admin_all" on public.pitch_slots
  for all using (is_admin()) with check (is_admin());

drop policy if exists "pitch_sessions_select_via_slot" on public.pitch_sessions;
create policy "pitch_sessions_select_via_slot" on public.pitch_sessions
  for select using (
    exists (
      select 1 from public.pitch_slots ps
      join public.team_members tm on tm.team_id = ps.team_id
      where ps.session_id = public.pitch_sessions.id and tm.user_id = auth.uid() and ps.invite_sent_at is not null
    )
  );
drop policy if exists "pitch_sessions_select_jury" on public.pitch_sessions;
create policy "pitch_sessions_select_jury" on public.pitch_sessions
  for select using (
    exists (
      select 1 from public.judge_assignments ja
      where ja.hackathon_id = public.pitch_sessions.hackathon_id and ja.judge_id = auth.uid()
    )
  );
drop policy if exists "pitch_sessions_admin_all" on public.pitch_sessions;
create policy "pitch_sessions_admin_all" on public.pitch_sessions
  for all using (is_admin()) with check (is_admin());

-- ── winners: special mentions alongside numbered rank ──
alter table public.winners add column if not exists special_mention boolean not null default false;
alter table public.winners add column if not exists special_mention_label text;
-- rank was `not null` for a strict 1st/2nd/3rd podium; a special mention has no numeric rank.
alter table public.winners alter column rank drop not null;
