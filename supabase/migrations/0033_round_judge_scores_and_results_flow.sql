-- Admin Results flow: Round 1 shortlist -> Round 2 meeting -> Winners, consolidated into
-- /admin/results/[hackathonId] (replacing /admin/rounds).

-- ── pitch_sessions: round-aware (Round 1 pitch vs Round 2 demo meeting) ──
-- Existing rows predate this column and are all genuinely Round 1 sessions, so default 1 is
-- exactly correct for them, not just a placeholder.
alter table public.pitch_sessions add column if not exists round smallint not null default 1 check (round in (1, 2));
create index if not exists pitch_sessions_hackathon_round_idx on public.pitch_sessions (hackathon_id, round);

-- ── round_judge_scores: per-judge, per-round scores ──
-- The existing `evaluations` table (0001) is per-judge but NOT round-aware
-- (unique(judge_id, team_id) — one evaluation per judge per team, ever) and is the table the
-- existing jury scoring UI (app/jury/(dashboard)/scoring/[teamId]) writes to; that page and
-- table are left untouched entirely, per instruction. team_round_status (0031) has a single
-- `score` column per team per round with no judge dimension at all — fine for admin to read/
-- override, but structurally incapable of showing "each judge's score" or "2/3 judges scored".
-- This new table is what actually was missing: one row per (team, round, judge).
create table if not exists public.round_judge_scores (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  hackathon_id uuid not null references public.hackathons(id) on delete cascade,
  round int not null check (round in (1, 2)),
  judge_id uuid not null references public.users(id) on delete cascade,
  score numeric not null check (score >= 0 and score <= 100),
  remarks text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (team_id, round, judge_id)
);
create index if not exists round_judge_scores_team_round_idx on public.round_judge_scores (team_id, round);
create index if not exists round_judge_scores_hackathon_round_idx on public.round_judge_scores (hackathon_id, round);

alter table public.round_judge_scores enable row level security;

-- A judge reads/writes only their own scores; every actual write in this app goes through a
-- service-role route regardless (same pattern as team_round_status), so this SELECT is enough
-- for a judge-facing page to show "your own score" without a round trip through the API.
drop policy if exists "round_judge_scores_select_own" on public.round_judge_scores;
create policy "round_judge_scores_select_own" on public.round_judge_scores
  for select using (judge_id = auth.uid());
drop policy if exists "round_judge_scores_admin_all" on public.round_judge_scores;
create policy "round_judge_scores_admin_all" on public.round_judge_scores
  for all using (is_admin()) with check (is_admin());

-- ── team_round_status: prevent duplicate 1st/2nd/3rd within a hackathon+round ──
-- A partial unique index rather than a full one — only positions 1/2/3 need to be unique;
-- anything else (4th, 5th, ... or null) is unrestricted.
create unique index if not exists team_round_status_top3_uniq
  on public.team_round_status (hackathon_id, round, position)
  where position in (1, 2, 3);

-- Whether Round 1/2 scores themselves (not shortlist/position, already visible once published)
-- are shown to participants — off by default, matching what the participant UI already does
-- today (never shows a raw score).
alter table public.hackathons add column if not exists show_round_scores_to_participants boolean not null default false;

-- ── audit log for every publish/unpublish/send-invites action ──
create table if not exists public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.users(id) on delete set null,
  action text not null,
  hackathon_id uuid references public.hackathons(id) on delete cascade,
  details jsonb,
  created_at timestamptz not null default now()
);
create index if not exists admin_audit_log_hackathon_idx on public.admin_audit_log (hackathon_id, created_at desc);

alter table public.admin_audit_log enable row level security;
drop policy if exists "admin_audit_log_admin_all" on public.admin_audit_log;
create policy "admin_audit_log_admin_all" on public.admin_audit_log
  for all using (is_admin()) with check (is_admin());
