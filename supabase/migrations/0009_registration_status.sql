-- Payment-gated registration state machine.
--
-- registered -> payment_pending -> payment_submitted -> approved -> team_created -> submitted
--                                          |
--                                          -> rejected (participant can re-pay, back to payment_pending)
--
-- auth.uid() works fine in this project (real Supabase session auth, confirmed
-- across every existing RLS policy) — the gap this migration closes is that
-- registrations_update_own previously let a participant set ANY column on
-- their own row, including a hypothetical status column, directly from the
-- browser. State-machine transitions now only happen through app/api/**
-- routes using the service-role client, which validate the current status
-- before writing. Column-level REVOKE below makes that the only path, not
-- just an app-level convention.

create type registration_status as enum (
  'registered',
  'payment_pending',
  'payment_submitted',
  'approved',
  'rejected',
  'team_created',
  'submitted'
);

alter table public.registrations
  add column if not exists status registration_status not null default 'registered';

alter table public.registrations
  add column if not exists payment_amount numeric,
  add column if not exists payment_reference text,
  add column if not exists reviewed_by uuid references public.users(id),
  add column if not exists reviewed_at timestamptz;

-- Existing rows (registration_status = 'confirmed') start fresh at 'registered'
-- in the new state machine — they never went through a payment step.

-- Only service_role (bypasses grants) may write these columns from here on.
-- registrations_update_own (RLS) still lets a participant touch other columns
-- on their own row; it can no longer move the state machine forward itself,
-- including pointing team_id at an arbitrary team.
revoke update (status, team_id, payment_amount, payment_reference, reviewed_by, reviewed_at)
  on public.registrations from authenticated;
