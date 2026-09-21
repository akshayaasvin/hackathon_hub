-- Webinars + a single shared payment ledger for Hackathon and Webinar payments.
--
--  * webinars               admin-managed events (fee is the ONLY source of truth for price)
--  * webinar_registrations  one row per (webinar, email); written by service-role code only
--  * payment_orders         (0017) now serves BOTH kinds: `kind` says which table the order
--                           belongs to, so the webhook / verify / sync code classifies a
--                           payment by looking the Razorpay order id up HERE, never by
--                           trusting anything the browser or a webhook note claims
--  * payment_events         audit + replay log for every webhook / verify / sync call

-- ─────────────────────────────────────────────────────────── webinars

create table public.webinars (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  starts_at timestamptz,
  join_url text,
  fee numeric not null default 0 check (fee >= 0),
  currency text not null default 'INR',
  status text not null default 'draft' check (status in ('draft', 'published', 'closed')),
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.webinars enable row level security;

-- Admin only. There is deliberately NO public/authenticated SELECT policy: the
-- public /webinar page reads published webinars through a server route (service
-- role, explicit column list), so `join_url` can never leak through the REST API.
create policy "webinars_admin_all" on public.webinars
  for all using (is_admin()) with check (is_admin());

-- ─────────────────────────────────────────────── webinar_registrations

create table public.webinar_registrations (
  id uuid primary key default gen_random_uuid(),
  webinar_id uuid not null references public.webinars(id) on delete restrict,
  full_name text not null,
  email text not null,
  phone text not null,
  status text not null default 'payment_pending' check (status in ('payment_pending', 'paid', 'free')),
  amount numeric,
  currency text,
  payment_id text unique,
  paid_at timestamptz,
  -- Capability token for the guest who created the registration (no login on
  -- /webinar). Needed to poll status; rotated every time the same email re-submits.
  access_token uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Duplicate protection: one registration per webinar per email (case-insensitive).
create unique index webinar_registrations_webinar_email_uniq
  on public.webinar_registrations (webinar_id, lower(email));
create index webinar_registrations_status_idx on public.webinar_registrations (webinar_id, status);

alter table public.webinar_registrations enable row level security;

-- Admin can read. No insert/update/delete policy exists, so every write is denied
-- for browser sessions; only service-role API routes can change this table.
create policy "webinar_registrations_admin_select" on public.webinar_registrations
  for select using (is_admin());

-- ───────────────────────────────────────────── payment_orders (shared)

alter table public.payment_orders alter column registration_id drop not null;

alter table public.payment_orders
  add column if not exists kind text not null default 'hackathon' check (kind in ('hackathon', 'webinar')),
  add column if not exists webinar_registration_id uuid references public.webinar_registrations(id) on delete cascade;

alter table public.payment_orders
  add constraint payment_orders_target_chk check (
    (kind = 'hackathon' and registration_id is not null and webinar_registration_id is null)
    or (kind = 'webinar' and webinar_registration_id is not null and registration_id is null)
  );

create index if not exists payment_orders_webinar_registration_id_idx
  on public.payment_orders (webinar_registration_id);

-- The same Razorpay payment can never be recorded as paid on two orders.
create unique index if not exists payment_orders_paid_payment_id_uniq
  on public.payment_orders (razorpay_payment_id)
  where razorpay_payment_id is not null and status = 'paid';

-- ───────────────────────────────────────────────────── payment_events

create table public.payment_events (
  id uuid primary key default gen_random_uuid(),
  -- x-razorpay-event-id for webhooks (Razorpay re-sends the SAME id on retries).
  -- Null for verify/sync calls; UNIQUE ignores nulls.
  event_id text unique,
  source text not null check (source in ('webhook', 'verify', 'sync')),
  event_type text,
  razorpay_order_id text,
  razorpay_payment_id text,
  outcome text not null,
  created_at timestamptz not null default now()
);
create index payment_events_payment_id_idx on public.payment_events (razorpay_payment_id);
create index payment_events_created_at_idx on public.payment_events (created_at desc);

alter table public.payment_events enable row level security;
create policy "payment_events_admin_select" on public.payment_events
  for select using (is_admin());
