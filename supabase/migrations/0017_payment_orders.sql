-- Per-attempt audit trail for the real Razorpay Orders API flow. Distinct
-- from registrations.payment_reference/payment_amount (0009), which only
-- ever hold the single most-recent payment's details — this table keeps
-- every order created (including abandoned/failed retries), which the old
-- hosted-button model had no way to track at all.

create table public.payment_orders (
  id uuid primary key default gen_random_uuid(),
  registration_id uuid not null references public.registrations(id) on delete cascade,
  razorpay_order_id text unique not null,
  razorpay_payment_id text,
  amount numeric not null,
  currency text not null default 'INR',
  status text not null default 'created' check (status in ('created', 'paid', 'failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index payment_orders_registration_id_idx on public.payment_orders(registration_id);

alter table public.payment_orders enable row level security;

create policy "payment_orders_select_own" on public.payment_orders
  for select using (
    exists (
      select 1 from public.registrations r
      where r.id = public.payment_orders.registration_id and r.user_id = auth.uid()
    )
  );
create policy "payment_orders_admin_all" on public.payment_orders
  for all using (is_admin()) with check (is_admin());

-- Written only by service-role app code (order creation route + webhook
-- handler), same lockdown pattern as 0011/0012 — never directly by the
-- browser, verified or not.
revoke insert, update on public.payment_orders from authenticated;

-- Distinguishes a Razorpay-verified payment from an offline/college-import
-- one (item 4) on the same registrations.status state machine.
alter table public.registrations
  add column if not exists payment_method text check (payment_method in ('razorpay', 'offline_import'));

revoke update (payment_method) on public.registrations from authenticated;
