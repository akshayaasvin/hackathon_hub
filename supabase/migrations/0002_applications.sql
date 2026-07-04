-- Enterprise approval workflow: college and jury applicants no longer get an
-- auth.users account (or a users/profile row) until an admin approves them.
-- Their submission lives in a staging table until then.

create table public.college_applications (
  id uuid primary key default gen_random_uuid(),
  college_name text not null,
  representative_name text not null,
  position_in_college text not null,
  date_of_birth date,
  official_email text not null unique,
  personal_email text,
  contact_number text not null,
  department text,
  college_address text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'changes_requested')),
  admin_notes text,
  reviewed_by uuid references public.users(id),
  reviewed_at timestamptz,
  created_user_id uuid references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index college_applications_status_idx on public.college_applications(status);

create table public.jury_applications (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  contact_number text not null,
  email text not null unique,
  official_email text,
  organization_name text,
  portfolio_url text,
  occupation text not null,
  experience_years int,
  date_of_birth date,
  location text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'changes_requested')),
  admin_notes text,
  reviewed_by uuid references public.users(id),
  reviewed_at timestamptz,
  created_user_id uuid references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index jury_applications_status_idx on public.jury_applications(status);

alter table public.college_applications enable row level security;
alter table public.jury_applications enable row level security;

-- No anon/authenticated policies at all: submissions are written by the
-- registration API route via the service-role client (bypasses RLS), and
-- only admins read/manage them from the browser.
create policy "college_applications_admin_all" on public.college_applications
  for all using (is_admin()) with check (is_admin());
create policy "jury_applications_admin_all" on public.jury_applications
  for all using (is_admin()) with check (is_admin());

-- approved_by/approved_at now live on the application row (reviewed_by/reviewed_at) —
-- this was duplicated data now that approval happens before the profile even exists.
alter table public.college_profiles drop column if exists approved_by;
alter table public.college_profiles drop column if exists approved_at;
alter table public.jury_profiles drop column if exists approved_by;
alter table public.jury_profiles drop column if exists approved_at;
