-- Admin bulk-delete toolkit: Payment Approvals ("Delete selected" on a registration) must be
-- a SOFT delete — a Razorpay-verified payment record must never be hard-deleted, and
-- payment_orders (0017) cascades on registrations.id, so a hard delete there would also
-- silently destroy the per-attempt payment audit trail. deleted_at mirrors the
-- hackathons.deleted_at pattern already used elsewhere in this schema.

alter table public.registrations add column if not exists deleted_at timestamptz;
create index if not exists registrations_hackathon_id_active_idx on public.registrations (hackathon_id) where deleted_at is null;

-- Soft-deleted registrations stay invisible to the participant themselves too, not just
-- admin list screens — same "hidden, not gone" contract as a soft-deleted hackathon.
drop policy if exists "registrations_select_own" on public.registrations;
create policy "registrations_select_own" on public.registrations
  for select using (user_id = auth.uid() and deleted_at is null);

drop policy if exists "registrations_select_college" on public.registrations;
create policy "registrations_select_college" on public.registrations
  for select using (
    deleted_at is null
    and exists (
      select 1 from public.participant_profiles pp
      where pp.user_id = public.registrations.user_id and pp.college_name = public.my_college_name()
    )
  );

-- deleted_at is a state-machine-style column exactly like status/team_id (0009) — only the
-- service-role bulk-delete route may ever set it, never a direct client write.
revoke update (deleted_at) on public.registrations from authenticated;
