-- Phase 2 (P0): duplicate team names, and one team per user per hackathon.

-- ── 1) Dedupe existing duplicate team names (case/whitespace-insensitive) within the same
--       hackathon, BEFORE adding the unique index below (which would otherwise fail to
--       create on data that already violates it). The oldest team in each colliding group
--       keeps its name; every later one is renamed "name (2)", "name (3)", ... — re-checking
--       for collisions against the generated name too, in case that name already exists.
do $$
declare
  grp record;
  team_row record;
  idx int;
  candidate text;
  renamed_count int := 0;
begin
  for grp in
    select hackathon_id, lower(trim(team_name)) as norm_name
    from public.teams
    group by hackathon_id, lower(trim(team_name))
    having count(*) > 1
  loop
    idx := 1;
    for team_row in
      select id, team_name
      from public.teams
      where hackathon_id = grp.hackathon_id and lower(trim(team_name)) = grp.norm_name
      order by created_at asc, id asc
    loop
      if idx > 1 then
        loop
          candidate := trim(team_row.team_name) || ' (' || idx || ')';
          exit when not exists (
            select 1 from public.teams
            where hackathon_id = grp.hackathon_id
              and lower(trim(team_name)) = lower(trim(candidate))
              and id <> team_row.id
          );
          idx := idx + 1;
        end loop;
        update public.teams set team_name = candidate, updated_at = now() where id = team_row.id;
        renamed_count := renamed_count + 1;
        raise notice 'Renamed duplicate team % (hackathon %): "%" -> "%"', team_row.id, grp.hackathon_id, team_row.team_name, candidate;
      end if;
      idx := idx + 1;
    end loop;
  end loop;
  raise notice 'Phase 2 dedupe: renamed % duplicate team name(s) total.', renamed_count;
end $$;

-- ── 2) One team name per hackathon, case/whitespace-insensitive. app/api/teams/route.ts
--       checks this up front for a friendly message; this index is the actual guarantee
--       (also catches a race between two simultaneous creates, which the app-level check
--       alone cannot).
create unique index if not exists teams_hackathon_id_name_uniq
  on public.teams (hackathon_id, lower(trim(team_name)));

-- ── 3) One team per user per hackathon. team_members has no hackathon_id today — added
--       here, backfilled from teams, and kept correct on every future insert by a trigger
--       (rather than requiring every INSERT call site, including Phase 3's not-yet-written
--       invite-accept path, to remember to set it).
alter table public.team_members add column if not exists hackathon_id uuid references public.hackathons(id) on delete cascade;

update public.team_members tm
set hackathon_id = t.hackathon_id
from public.teams t
where tm.team_id = t.id and tm.hackathon_id is null;

alter table public.team_members alter column hackathon_id set not null;

create or replace function public.set_team_member_hackathon_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.hackathon_id is null then
    select hackathon_id into new.hackathon_id from public.teams where id = new.team_id;
  end if;
  return new;
end;
$$;

drop trigger if exists team_members_set_hackathon_id on public.team_members;
create trigger team_members_set_hackathon_id
before insert on public.team_members
for each row execute function public.set_team_member_hackathon_id();

-- Postgres has no `add constraint if not exists`; the exception handler is what makes this
-- safe to re-run (e.g. after an earlier statement in this same file failed and the migration
-- needs replaying from the top).
do $$
begin
  alter table public.team_members
    add constraint team_members_hackathon_user_uniq unique (hackathon_id, user_id);
exception
  when duplicate_object then null;
end $$;
