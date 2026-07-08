-- Server-side backstop for the DOB rules already enforced by
-- lib/validation.ts (no future dates, minimum age 13 years) — defense in
-- depth in case a row is ever written outside the API route. `not valid`
-- so any pre-existing out-of-range rows don't block this migration from
-- applying; it still applies to every new insert/update from here on.
-- NULLs (college_profiles/jury_profiles/applications, all optional there)
-- satisfy a check constraint vacuously, so this only bites participant_profiles
-- in practice, where date_of_birth is always populated at signup.

alter table public.participant_profiles
  add constraint participant_dob_valid
  check (date_of_birth <= (current_date - interval '13 years')::date)
  not valid;
