-- Excel/CSV import flow for offline, college-collected payments (item 4).
-- Two-phase: an upload creates a 'previewing' batch (nothing on
-- registrations changes yet) so the admin can catch typos/unmatched emails;
-- only committing the batch marks the matched students paid. Every import
-- (and every row's match outcome) is kept for audit, matched or not.

create table public.college_payment_imports (
  id uuid primary key default gen_random_uuid(),
  college_id uuid not null references public.colleges(id) on delete cascade,
  hackathon_id uuid not null references public.hackathons(id) on delete cascade,
  file_name text not null,
  uploaded_by uuid references public.users(id) on delete set null,
  uploaded_at timestamptz not null default now(),
  status text not null default 'previewing' check (status in ('previewing', 'committed', 'cancelled')),
  committed_at timestamptz,
  committed_by uuid references public.users(id) on delete set null,
  total_rows int not null default 0,
  matched_count int not null default 0,
  unmatched_count int not null default 0
);
create index college_payment_imports_college_id_idx on public.college_payment_imports(college_id);
create index college_payment_imports_hackathon_id_idx on public.college_payment_imports(hackathon_id);

create table public.college_payment_import_rows (
  id uuid primary key default gen_random_uuid(),
  import_id uuid not null references public.college_payment_imports(id) on delete cascade,
  email text not null,
  student_name text,
  department text,
  payment_reference text,
  amount numeric,
  match_status text not null check (match_status in ('matched', 'unmatched')),
  registration_id uuid references public.registrations(id) on delete set null,
  created_at timestamptz not null default now()
);
create index college_payment_import_rows_import_id_idx on public.college_payment_import_rows(import_id);

alter table public.college_payment_imports enable row level security;
alter table public.college_payment_import_rows enable row level security;

-- Admin-only end to end: uploads/parses/commits all happen through
-- service-role API routes (file parsing + matching-by-email is not
-- something to run as a client-side RLS-scoped query).
create policy "college_payment_imports_admin_all" on public.college_payment_imports
  for all using (is_admin()) with check (is_admin());
create policy "college_payment_import_rows_admin_all" on public.college_payment_import_rows
  for all using (is_admin()) with check (is_admin());

revoke insert, update, delete on public.college_payment_imports from authenticated;
revoke insert, update, delete on public.college_payment_import_rows from authenticated;
