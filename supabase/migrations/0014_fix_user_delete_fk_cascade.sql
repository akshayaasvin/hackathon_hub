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
-- This is the database-level counterpart to the same 10-column clear-then-
-- delete logic already in app/api/admin/delete-user/route.ts — that app-level
-- step becomes redundant after this migration (Postgres now does it
-- automatically) but is left in place as harmless defense in depth.

alter table public.college_profiles
  drop constraint college_profiles_approved_by_fkey,
  add constraint college_profiles_approved_by_fkey
    foreign key (approved_by) references public.users(id) on delete set null;

alter table public.jury_profiles
  drop constraint jury_profiles_approved_by_fkey,
  add constraint jury_profiles_approved_by_fkey
    foreign key (approved_by) references public.users(id) on delete set null;

alter table public.hackathons
  drop constraint hackathons_created_by_fkey,
  add constraint hackathons_created_by_fkey
    foreign key (created_by) references public.users(id) on delete set null;

alter table public.teams
  drop constraint teams_team_lead_id_fkey,
  add constraint teams_team_lead_id_fkey
    foreign key (team_lead_id) references public.users(id) on delete set null;

alter table public.announcements
  drop constraint announcements_created_by_fkey,
  add constraint announcements_created_by_fkey
    foreign key (created_by) references public.users(id) on delete set null;

alter table public.college_applications
  drop constraint college_applications_reviewed_by_fkey,
  add constraint college_applications_reviewed_by_fkey
    foreign key (reviewed_by) references public.users(id) on delete set null;

alter table public.college_applications
  drop constraint college_applications_created_user_id_fkey,
  add constraint college_applications_created_user_id_fkey
    foreign key (created_user_id) references public.users(id) on delete set null;

alter table public.jury_applications
  drop constraint jury_applications_reviewed_by_fkey,
  add constraint jury_applications_reviewed_by_fkey
    foreign key (reviewed_by) references public.users(id) on delete set null;

alter table public.jury_applications
  drop constraint jury_applications_created_user_id_fkey,
  add constraint jury_applications_created_user_id_fkey
    foreign key (created_user_id) references public.users(id) on delete set null;

alter table public.registrations
  drop constraint registrations_reviewed_by_fkey,
  add constraint registrations_reviewed_by_fkey
    foreign key (reviewed_by) references public.users(id) on delete set null;
