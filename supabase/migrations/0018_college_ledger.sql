-- College payment settlement/commission tracking (item 4). Manual
-- reconciliation only — colleges collect fees themselves (offline, via the
-- Excel/CSV import in 0019) and self-report; this is NOT Razorpay Route or
-- automatic splitting.

alter table public.colleges
  add column if not exists commission_percent numeric not null default 0,
  add column if not exists settlement_status text not null default 'pending' check (settlement_status in ('pending', 'settled')),
  add column if not exists settled_at timestamptz,
  add column if not exists settled_by uuid references public.users(id) on delete set null,
  add column if not exists last_settled_amount numeric;

-- Audit log of every "Mark Settled" action (colleges only stores the latest
-- settlement snapshot; this keeps history across multiple settlement rounds).
create table public.college_settlements (
  id uuid primary key default gen_random_uuid(),
  college_id uuid not null references public.colleges(id) on delete cascade,
  amount numeric not null,
  settled_by uuid references public.users(id) on delete set null,
  settled_at timestamptz not null default now(),
  notes text
);
create index college_settlements_college_id_idx on public.college_settlements(college_id);

alter table public.college_settlements enable row level security;
create policy "college_settlements_admin_all" on public.college_settlements
  for all using (is_admin()) with check (is_admin());

revoke update (commission_percent, settlement_status, settled_at, settled_by, last_settled_amount)
  on public.colleges from authenticated;
