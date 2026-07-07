-- Fixes "Unable to delete row... still referenced from table X" errors when
-- deleting a user, by giving every remaining NO ACTION foreign key into
-- users(id) an explicit ON DELETE behavior at the database level.
--
-- Full audit of every FK referencing public.users(id) (confirmed by reading
-- every migration that touches these tables, not guessed):
--
--   Already correct (ownership rows — deleting the user should delete these
--   too, and they already do, set in 0001_init.sql):
--     participant_profiles.user_id   on delete cascade
--     college_profiles.user_id       on delete cascade
--     jury_profiles.user_id          on delete cascade
--     team_members.user_id           on delete cascade
--     registrations.user_id          on delete cascade
--     evaluations.judge_id           on delete cascade
--     certificates.user_id           on delete cascade
--     judge_assignments.judge_id     on delete cascade
--     notifications.user_id          on delete cascade
--
--   Missing an explicit behavior (defaulted to NO ACTION, blocking deletes) —
--   fixed below. Every one of these is a "who did this" pointer to some OTHER
--   row's owner (almost always the reviewing/approving admin), not the row's
--   own identity — so SET NULL is correct everywhere here, not CASCADE.
--   Cascading any of these would mean deleting one admin silently deletes
--   every hackathon/announcement/application they ever touched, or deleting
--   a team lead wipes out their whole team's submission/evaluation history.
--   All 10 columns are already nullable, so SET NULL is valid for every one:
--     college_profiles.approved_by
--     jury_profiles.approved_by
--     hackathons.created_by
--     teams.team_lead_id
--     announcements.created_by
--     college_applications.reviewed_by
--     college_applications.created_user_id
--     jury_applications.reviewed_by
--     jury_applications.created_user_id
--     registrations.reviewed_by
--
-- The first version of this migration hardcoded the assumed constraint names
-- (<table>_<column>_fkey) and failed with "constraint ... does not exist" —
-- at least one of them wasn't actually named that way in this database. This
-- version looks up each FK's real name from pg_constraint instead of
-- assuming it, so it can't fail on a naming mismatch again.
--
-- This is the database-level counterpart to the same 10-column clear-then-
-- delete logic already in app/api/admin/delete-user/route.ts — that app-level
-- step becomes redundant after this migration (Postgres now does it
-- automatically) but is left in place as harmless defense in depth.

do $$
declare
  targets text[][] := array[
    array['college_profiles', 'approved_by'],
    array['jury_profiles', 'approved_by'],
    array['hackathons', 'created_by'],
    array['teams', 'team_lead_id'],
    array['announcements', 'created_by'],
    array['college_applications', 'reviewed_by'],
    array['college_applications', 'created_user_id'],
    array['jury_applications', 'reviewed_by'],
    array['jury_applications', 'created_user_id'],
    array['registrations', 'reviewed_by']
  ];
  tgt text[];
  t text;
  c text;
  existing_constraint text;
begin
  foreach tgt slice 1 in array targets loop
    t := tgt[1];
    c := tgt[2];

    -- Find whatever this column's actual FK-into-users(id) constraint is
    -- currently named, regardless of naming convention.
    select con.conname into existing_constraint
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    join pg_attribute att
      on att.attrelid = rel.oid
      and att.attnum = con.conkey[1]
    where nsp.nspname = 'public'
      and rel.relname = t
      and att.attname = c
      and con.contype = 'f'
      and array_length(con.conkey, 1) = 1
    limit 1;

    if existing_constraint is not null then
      execute format('alter table public.%I drop constraint %I', t, existing_constraint);
    end if;

    execute format(
      'alter table public.%I add constraint %I foreign key (%I) references public.users(id) on delete set null',
      t, t || '_' || c || '_fkey', c
    );

    raise notice 'Fixed FK: %.% (was %)', t, c, coalesce(existing_constraint, '<none found>');
  end loop;
end $$;
