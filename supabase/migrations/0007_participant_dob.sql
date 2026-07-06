-- Participant registration now collects Date of Birth (required going forward
-- at the application/validation layer). Column is nullable so existing
-- participant_profiles rows aren't broken by the backfill.
alter table public.participant_profiles add column if not exists date_of_birth date;
