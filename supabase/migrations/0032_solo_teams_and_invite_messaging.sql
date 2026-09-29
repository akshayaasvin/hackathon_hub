-- P1: solo participation.
--
-- "Participate Solo" (app/api/teams/solo/route.ts) creates a real team of one, displaying the
-- participant's own name as the team_name — several participants can easily share a display
-- name (two "John Smith"s), which the existing case-insensitive unique-name index (migration
-- 0029) would otherwise reject on the second one. Solo teams are exempted from that
-- uniqueness check entirely via a partial index (leader-created teams keep the original
-- guarantee unchanged).
alter table public.teams add column if not exists is_solo boolean not null default false;

drop index if exists teams_hackathon_id_name_uniq;
create unique index if not exists teams_hackathon_id_name_uniq
  on public.teams (hackathon_id, lower(trim(team_name)))
  where not is_solo;
