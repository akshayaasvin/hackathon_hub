-- Internship Management System.
--
-- Deliberately independent of participant login (see app/internship/**): a student never
-- needs a HackathonHub account to apply. Everything reuses the existing shared architecture
-- instead of a parallel one:
--   * payment: the SAME payment_orders / payment_events / settlePayment() flow as
--     Hackathon + Webinar (0017, 0023) — this migration only teaches `payment_orders`
--     a third `kind`.
--   * admin auth: the SAME is_admin() used everywhere else.
--   * email: the SAME lib/email.ts sendEmail(), with per-internship admin-authored content
--     (never hard-coded) — see internships.email_* columns below.

-- ─────────────────────────────────────────────────────────────────── internships

create table public.internships (
  id uuid primary key default gen_random_uuid(),

  title text not null,
  topic text,
  description text,
  category text,
  skills_required text[] not null default '{}',
  eligibility_text text,
  duration_text text,
  mode text not null default 'online' check (mode in ('online', 'offline', 'hybrid')),

  start_date date,
  end_date date,
  application_deadline date,
  seats_total int check (seats_total is null or seats_total > 0),

  is_paid boolean not null default false,
  fee numeric not null default 0 check (fee >= 0),
  currency text not null default 'INR',

  -- Eligibility assessment (Google-Form-like; see lib/internshipAssessment.ts).
  -- Each question: {id,label,type,required,options?,correctAnswer?,marks}. Correct answers
  -- are stored here and NEVER selected by any public-facing route — only scored server-side.
  assessment_enabled boolean not null default false,
  assessment_passing_score_percent int not null default 60 check (assessment_passing_score_percent between 0 and 100),
  assessment_time_limit_minutes int check (assessment_time_limit_minutes is null or assessment_time_limit_minutes > 0),
  assessment_questions jsonb not null default '[]'::jsonb,

  -- Registration form (Google-Form-like; see lib/internshipForm.ts).
  -- {fixedFields:[{key,required}], questions:[...same shape as assessment_questions, no marks]}
  form_config jsonb not null default '{"fixedFields":[],"questions":[]}'::jsonb,

  -- Admin-authored confirmation email (never hard-coded; supports {{placeholders}} — see
  -- lib/email.ts renderInternshipEmail()). email_body supports a small safe subset of
  -- markdown: **bold**, "- " bullet lines, [text](url) links, blank-line paragraphs.
  email_subject text,
  email_heading text,
  email_body text,
  email_cta_text text,
  email_cta_link text,
  email_instructions text,
  email_support_contact text,

  banner_url text,
  status text not null default 'draft' check (status in ('draft', 'published', 'closed', 'archived')),

  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index internships_status_idx on public.internships (status);

alter table public.internships enable row level security;

-- Admin only, same pattern as `webinars` (0023): no public/authenticated SELECT policy at
-- all. The public /internship pages and API read through a server route using the
-- service-role client with an explicit column list, so assessment_questions' correctAnswer
-- values and internal fields can never be fetched directly over the REST API.
create policy "internships_admin_all" on public.internships
  for all using (is_admin()) with check (is_admin());

-- ─────────────────────────────────────────────────────────────── internship_registrations

-- Human-readable registration codes: INT-2026-000123. Generated server-side (trigger
-- below), never client-supplied, and this is what the public status page and the
-- confirmation email use to identify a registration without requiring login.
create sequence public.internship_registration_seq;

create table public.internship_registrations (
  id uuid primary key default gen_random_uuid(),
  registration_code text unique not null default '',

  internship_id uuid not null references public.internships(id) on delete restrict,
  -- Set server-side from the caller's OWN Supabase session if one exists at registration
  -- time (never client-supplied) — see app/api/internship/[id]/register/route.ts. Null for
  -- the (expected, normal) case of an applicant with no HackathonHub account.
  student_id uuid references public.users(id) on delete set null,

  full_name text not null default '',
  email text not null default '',
  phone text not null default '',
  -- All fixed-field values (college, degree, linkedin_url, ...) plus custom question
  -- answers, keyed by field/question id — same "answers snapshot" pattern as
  -- webinar_registrations.answers (0024): editing the form later never rewrites what an
  -- applicant already answered.
  form_answers jsonb not null default '[]'::jsonb,
  -- Storage path in the private 'internship-resumes' bucket (server-uploaded — see the
  -- register route; never a client-writable path). Null when no resume was required/given.
  resume_path text,

  status text not null default 'applied' check (status in (
    'applied', 'assessment_pending', 'eligible', 'not_eligible',
    'payment_pending', 'registered', 'active', 'completed', 'certificate_issued', 'rejected'
  )),

  assessment_score numeric,
  assessment_total numeric,
  assessment_passed boolean,
  assessment_started_at timestamptz,
  assessment_submitted_at timestamptz,

  amount numeric,
  currency text,
  payment_id text unique,
  paid_at timestamptz,

  -- Capability token for the guest who applied (no login). Rotated on every (re)submit of
  -- the assessment-start / register step — same pattern as webinar_registrations (0023/0024).
  access_token uuid not null default gen_random_uuid(),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One application per internship per email (case-insensitive) — mirrors webinar_registrations.
create unique index internship_registrations_internship_email_uniq
  on public.internship_registrations (internship_id, lower(email))
  where email <> '';
create index internship_registrations_status_idx on public.internship_registrations (internship_id, status);
create index internship_registrations_student_id_idx on public.internship_registrations (student_id);

create or replace function public.set_internship_registration_code()
returns trigger
language plpgsql
as $$
begin
  if new.registration_code is null or new.registration_code = '' then
    new.registration_code := 'INT-' || to_char(now(), 'YYYY') || '-' ||
      lpad(nextval('public.internship_registration_seq')::text, 6, '0');
  end if;
  return new;
end;
$$;

create trigger internship_registrations_set_code
  before insert on public.internship_registrations
  for each row execute function public.set_internship_registration_code();

alter table public.internship_registrations enable row level security;

-- Admin can read. No insert/update/delete policy exists (same as webinar_registrations),
-- so every write is denied for ordinary sessions — only service-role API routes can change
-- this table, which is what lets the register/assessment routes work without login.
create policy "internship_registrations_admin_select" on public.internship_registrations
  for select using (is_admin());

-- ─────────────────────────────────────────────────────────────── payment_orders (shared)

alter table public.payment_orders
  add column if not exists internship_registration_id uuid references public.internship_registrations(id) on delete cascade;

alter table public.payment_orders drop constraint if exists payment_orders_target_chk;

-- The `kind` column's own check constraint (kind in ('hackathon','webinar')) from 0023 was
-- added inline without an explicit name, so Postgres auto-named it — rather than guess that
-- name, find it dynamically: the CHECK on payment_orders that mentions `kind` but none of
-- the per-kind target columns (that's what distinguishes it from payment_orders_target_chk,
-- dropped above by its known, explicitly-given name).
do $$
declare
  con record;
begin
  for con in
    select conname from pg_constraint
    where conrelid = 'public.payment_orders'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%kind%'
      and pg_get_constraintdef(oid) not ilike '%registration_id%'
  loop
    execute format('alter table public.payment_orders drop constraint %I', con.conname);
  end loop;
end $$;

alter table public.payment_orders
  add constraint payment_orders_kind_check check (kind in ('hackathon', 'webinar', 'internship'));

alter table public.payment_orders
  add constraint payment_orders_target_chk check (
    (kind = 'hackathon' and registration_id is not null and webinar_registration_id is null and internship_registration_id is null)
    or (kind = 'webinar' and webinar_registration_id is not null and registration_id is null and internship_registration_id is null)
    or (kind = 'internship' and internship_registration_id is not null and registration_id is null and webinar_registration_id is null)
  );

create index if not exists payment_orders_internship_registration_id_idx
  on public.payment_orders (internship_registration_id);

-- ─────────────────────────────────────────────────────────────────────── storage

-- Private bucket for resume uploads. No storage.objects RLS policy is created for it on
-- purpose: every read/write goes through a server route using the service-role client
-- (register route uploads; admin routes generate short-lived signed URLs to view one), so
-- there is nothing for a browser session — anon OR authenticated — to access directly.
insert into storage.buckets (id, name, public)
values ('internship-resumes', 'internship-resumes', false)
on conflict (id) do nothing;
