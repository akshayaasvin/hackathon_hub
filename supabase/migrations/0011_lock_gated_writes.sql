-- Team creation and submissions are now gated by registration.status and go
-- through app/api/teams and app/api/submissions (service-role, validates the
-- state machine before writing). Revoking direct client insert/update here
-- means the gating can't be bypassed by calling the Supabase REST API
-- directly with a participant's own session — the API route is the only path,
-- not just an app-level convention enforced by a disabled button.
--
-- team_members is intentionally left alone: RLS (team_members_insert) already
-- correctly scopes it to "add yourself" or "team lead adds anyone", and it's
-- still used directly by the client for the separate "invite a teammate"
-- feature, which isn't part of the payment/approval state machine.
revoke insert, update on public.teams from authenticated;
revoke insert, update on public.submissions from authenticated;
