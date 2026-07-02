-- HackathonHub — initial schema, triggers, and Row Level Security policies.
-- Run this once against the Supabase project (SQL editor, or `supabase db push`).

create extension if not exists pgcrypto;

-- ============================================================================
-- TABLES
-- ============================================================================

create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  full_name text,
  role text not null check (role in ('admin','participant','college','jury')),
  status text not null default 'pending' check (status in ('pending','approved','rejected','active')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index users_role_idx on public.users(role);
create index users_status_idx on public.users(status);
create index users_email_idx on public.users(email);

create table public.participant_profiles (
  user_id uuid primary key references public.users(id) on delete cascade,
  college_name text not null,
  passout_year int not null,
  degree text not null,
  domain text not null,
  experience_level text not null check (experience_level in ('fresher','experienced')),
  contact_number text not null,
  address text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index participant_profiles_college_name_idx on public.participant_profiles(college_name);

create table public.college_profiles (
  user_id uuid primary key references public.users(id) on delete cascade,
  college_name text not null,
  representative_name text not null,
  position_in_college text not null,
  date_of_birth date,
  official_email text not null,
  personal_email text,
  contact_number text not null,
  department text,
  college_address text not null,
  approved_by uuid references public.users(id),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index college_profiles_college_name_idx on public.college_profiles(college_name);

create table public.jury_profiles (
  user_id uuid primary key references public.users(id) on delete cascade,
  full_name text not null,
  contact_number text not null,
  email text not null,
  official_email text,
  organization_name text,
  portfolio_url text,
  occupation text not null,
  experience_years int,
  date_of_birth date,
  location text not null,
  approved_by uuid references public.users(id),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.hackathons (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  theme text,
  banner_url text,
  rules text,
  eligibility text,
  registration_deadline timestamptz,
  start_date timestamptz,
  end_date timestamptz,
  prize_details text,
  max_team_size int not null default 4,
  status text not null default 'draft' check (status in ('draft','published','ongoing','completed')),
  created_by uuid references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index hackathons_status_idx on public.hackathons(status);

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  hackathon_id uuid not null references public.hackathons(id) on delete cascade,
  team_name text not null,
  team_code text unique not null default substr(replace(gen_random_uuid()::text, '-', ''), 1, 8),
  team_lead_id uuid references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index teams_hackathon_id_idx on public.teams(hackathon_id);

create table public.team_members (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  unique (team_id, user_id)
);
create index team_members_team_id_idx on public.team_members(team_id);
create index team_members_user_id_idx on public.team_members(user_id);

create table public.registrations (
  id uuid primary key default gen_random_uuid(),
  hackathon_id uuid not null references public.hackathons(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  team_id uuid references public.teams(id) on delete set null,
  registration_status text not null default 'pending' check (registration_status in ('pending','confirmed','cancelled')),
  registered_at timestamptz not null default now()
);
create index registrations_hackathon_id_idx on public.registrations(hackathon_id);
create index registrations_user_id_idx on public.registrations(user_id);

create table public.submissions (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  hackathon_id uuid not null references public.hackathons(id) on delete cascade,
  project_title text,
  problem_statement text,
  solution text,
  features text,
  repo_link text,
  demo_video_url text,
  ppt_url text,
  report_pdf_url text,
  status text not null default 'draft' check (status in ('draft','submitted')),
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index submissions_team_id_idx on public.submissions(team_id);
create index submissions_hackathon_id_idx on public.submissions(hackathon_id);

create table public.evaluations (
  id uuid primary key default gen_random_uuid(),
  judge_id uuid not null references public.users(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  hackathon_id uuid not null references public.hackathons(id) on delete cascade,
  innovation_score numeric not null check (innovation_score >= 0 and innovation_score <= 25),
  technical_score numeric not null check (technical_score >= 0 and technical_score <= 25),
  ux_score numeric not null check (ux_score >= 0 and ux_score <= 20),
  feasibility_score numeric not null check (feasibility_score >= 0 and feasibility_score <= 15),
  presentation_score numeric not null check (presentation_score >= 0 and presentation_score <= 15),
  total_score numeric generated always as
    (innovation_score + technical_score + ux_score + feasibility_score + presentation_score) stored,
  feedback text,
  submitted_at timestamptz not null default now(),
  unique (judge_id, team_id)
);
create index evaluations_team_id_idx on public.evaluations(team_id);
create index evaluations_hackathon_id_idx on public.evaluations(hackathon_id);

create table public.certificates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  hackathon_id uuid not null references public.hackathons(id) on delete cascade,
  certificate_type text not null check (certificate_type in ('participant','finalist','winner','judge')),
  certificate_id text unique not null,
  verification_code text unique not null default replace(gen_random_uuid()::text, '-', ''),
  pdf_url text,
  issued_at timestamptz not null default now()
);
create index certificates_user_id_idx on public.certificates(user_id);
create index certificates_hackathon_id_idx on public.certificates(hackathon_id);

create table public.judge_assignments (
  id uuid primary key default gen_random_uuid(),
  judge_id uuid not null references public.users(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  hackathon_id uuid not null references public.hackathons(id) on delete cascade,
  assigned_at timestamptz not null default now(),
  unique (judge_id, team_id)
);
create index judge_assignments_judge_id_idx on public.judge_assignments(judge_id);
create index judge_assignments_team_id_idx on public.judge_assignments(team_id);

-- Supplementary tables (not in the original spec, kept to support existing
-- working features: NotificationBell, admin/announcements, winners podium + certificates).

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  title text not null,
  message text not null,
  type text default 'info',
  read boolean not null default false,
  created_at timestamptz not null default now()
);
create index notifications_user_id_idx on public.notifications(user_id);

create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  message text not null,
  target_role text not null default 'all' check (target_role in ('all','participant','admin','jury','college')),
  created_by uuid references public.users(id),
  created_at timestamptz not null default now()
);

create table public.winners (
  id uuid primary key default gen_random_uuid(),
  hackathon_id uuid not null references public.hackathons(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  rank int not null,
  prize_amount numeric,
  declared_at timestamptz not null default now(),
  unique (hackathon_id, team_id)
);
create index winners_hackathon_id_idx on public.winners(hackathon_id);

-- ============================================================================
-- HELPER FUNCTIONS (security definer so they can be safely called from RLS
-- policies without recursing into the RLS of the tables they read)
-- ============================================================================

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.users where id = auth.uid() and role = 'admin'
  );
$$;

create or replace function public.my_college_name()
returns text
language sql
security definer
set search_path = public
stable
as $$
  select college_name from public.college_profiles where user_id = auth.uid();
$$;

-- ============================================================================
-- TRIGGER: auto-activate participants once they confirm their email
-- ============================================================================

create or replace function public.handle_auth_email_confirmed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email_confirmed_at is not null and old.email_confirmed_at is null then
    update public.users
    set status = 'active', updated_at = now()
    where id = new.id and role = 'participant' and status = 'pending';
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_email_confirmed on auth.users;
create trigger on_auth_email_confirmed
after update of email_confirmed_at on auth.users
for each row execute function public.handle_auth_email_confirmed();

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

alter table public.users enable row level security;
alter table public.participant_profiles enable row level security;
alter table public.college_profiles enable row level security;
alter table public.jury_profiles enable row level security;
alter table public.hackathons enable row level security;
alter table public.teams enable row level security;
alter table public.team_members enable row level security;
alter table public.registrations enable row level security;
alter table public.submissions enable row level security;
alter table public.evaluations enable row level security;
alter table public.certificates enable row level security;
alter table public.judge_assignments enable row level security;
alter table public.notifications enable row level security;
alter table public.announcements enable row level security;
alter table public.winners enable row level security;

-- users ----------------------------------------------------------------------
create policy "users_select_own" on public.users
  for select using (id = auth.uid());
create policy "users_select_college_scoped" on public.users
  for select using (
    role = 'participant' and exists (
      select 1 from public.participant_profiles pp
      where pp.user_id = public.users.id and pp.college_name = public.my_college_name()
    )
  );
create policy "users_update_own" on public.users
  for update using (id = auth.uid()) with check (id = auth.uid());
create policy "users_admin_all" on public.users
  for all using (is_admin()) with check (is_admin());

-- participant_profiles ---------------------------------------------------------
create policy "participant_profiles_select_own" on public.participant_profiles
  for select using (user_id = auth.uid());
create policy "participant_profiles_update_own" on public.participant_profiles
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "participant_profiles_select_college" on public.participant_profiles
  for select using (college_name = public.my_college_name());
create policy "participant_profiles_select_jury" on public.participant_profiles
  for select using (
    exists (
      select 1 from public.judge_assignments ja
      join public.team_members tm on tm.team_id = ja.team_id
      where ja.judge_id = auth.uid() and tm.user_id = public.participant_profiles.user_id
    )
  );
create policy "participant_profiles_admin_all" on public.participant_profiles
  for all using (is_admin()) with check (is_admin());

-- college_profiles ---------------------------------------------------------
create policy "college_profiles_select_own" on public.college_profiles
  for select using (user_id = auth.uid());
create policy "college_profiles_update_own" on public.college_profiles
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "college_profiles_admin_all" on public.college_profiles
  for all using (is_admin()) with check (is_admin());

-- jury_profiles ---------------------------------------------------------
create policy "jury_profiles_select_own" on public.jury_profiles
  for select using (user_id = auth.uid());
create policy "jury_profiles_update_own" on public.jury_profiles
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "jury_profiles_admin_all" on public.jury_profiles
  for all using (is_admin()) with check (is_admin());

-- hackathons ---------------------------------------------------------
create policy "hackathons_select_published" on public.hackathons
  for select using (status in ('published', 'ongoing', 'completed'));
create policy "hackathons_admin_all" on public.hackathons
  for all using (is_admin()) with check (is_admin());

-- teams ---------------------------------------------------------
create policy "teams_select_member" on public.teams
  for select using (
    team_lead_id = auth.uid()
    or exists (select 1 from public.team_members tm where tm.team_id = public.teams.id and tm.user_id = auth.uid())
  );
create policy "teams_select_jury_assigned" on public.teams
  for select using (
    exists (select 1 from public.judge_assignments ja where ja.team_id = public.teams.id and ja.judge_id = auth.uid())
  );
create policy "teams_select_college" on public.teams
  for select using (
    exists (
      select 1 from public.team_members tm
      join public.participant_profiles pp on pp.user_id = tm.user_id
      where tm.team_id = public.teams.id and pp.college_name = public.my_college_name()
    )
  );
create policy "teams_select_completed_hackathon" on public.teams
  for select using (
    exists (select 1 from public.hackathons h where h.id = public.teams.hackathon_id and h.status = 'completed')
  );
create policy "teams_insert_lead" on public.teams
  for insert with check (team_lead_id = auth.uid());
create policy "teams_update_lead" on public.teams
  for update using (team_lead_id = auth.uid()) with check (team_lead_id = auth.uid());
create policy "teams_admin_all" on public.teams
  for all using (is_admin()) with check (is_admin());

-- team_members ---------------------------------------------------------
create policy "team_members_select_own_team" on public.team_members
  for select using (
    user_id = auth.uid()
    or exists (select 1 from public.team_members tm2 where tm2.team_id = public.team_members.team_id and tm2.user_id = auth.uid())
  );
create policy "team_members_select_college" on public.team_members
  for select using (
    exists (
      select 1 from public.participant_profiles pp
      where pp.user_id = public.team_members.user_id and pp.college_name = public.my_college_name()
    )
  );
create policy "team_members_select_jury" on public.team_members
  for select using (
    exists (select 1 from public.judge_assignments ja where ja.team_id = public.team_members.team_id and ja.judge_id = auth.uid())
  );
create policy "team_members_insert" on public.team_members
  for insert with check (
    user_id = auth.uid()
    or exists (select 1 from public.teams t where t.id = public.team_members.team_id and t.team_lead_id = auth.uid())
  );
create policy "team_members_delete" on public.team_members
  for delete using (
    user_id = auth.uid()
    or exists (select 1 from public.teams t where t.id = public.team_members.team_id and t.team_lead_id = auth.uid())
  );
create policy "team_members_admin_all" on public.team_members
  for all using (is_admin()) with check (is_admin());

-- registrations ---------------------------------------------------------
create policy "registrations_select_own" on public.registrations
  for select using (user_id = auth.uid());
create policy "registrations_insert_own" on public.registrations
  for insert with check (user_id = auth.uid());
create policy "registrations_update_own" on public.registrations
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "registrations_select_college" on public.registrations
  for select using (
    exists (
      select 1 from public.participant_profiles pp
      where pp.user_id = public.registrations.user_id and pp.college_name = public.my_college_name()
    )
  );
create policy "registrations_admin_all" on public.registrations
  for all using (is_admin()) with check (is_admin());

-- submissions ---------------------------------------------------------
create policy "submissions_select_team" on public.submissions
  for select using (
    exists (select 1 from public.team_members tm where tm.team_id = public.submissions.team_id and tm.user_id = auth.uid())
  );
create policy "submissions_insert_team" on public.submissions
  for insert with check (
    exists (select 1 from public.team_members tm where tm.team_id = public.submissions.team_id and tm.user_id = auth.uid())
  );
create policy "submissions_update_team" on public.submissions
  for update using (
    exists (select 1 from public.team_members tm where tm.team_id = public.submissions.team_id and tm.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.team_members tm where tm.team_id = public.submissions.team_id and tm.user_id = auth.uid())
  );
create policy "submissions_select_jury" on public.submissions
  for select using (
    exists (select 1 from public.judge_assignments ja where ja.team_id = public.submissions.team_id and ja.judge_id = auth.uid())
  );
create policy "submissions_select_college" on public.submissions
  for select using (
    exists (
      select 1 from public.team_members tm
      join public.participant_profiles pp on pp.user_id = tm.user_id
      where tm.team_id = public.submissions.team_id and pp.college_name = public.my_college_name()
    )
  );
create policy "submissions_admin_all" on public.submissions
  for all using (is_admin()) with check (is_admin());

-- evaluations ---------------------------------------------------------
create policy "evaluations_select_own_judge" on public.evaluations
  for select using (judge_id = auth.uid());
create policy "evaluations_insert_own_judge" on public.evaluations
  for insert with check (
    judge_id = auth.uid()
    and exists (select 1 from public.judge_assignments ja where ja.judge_id = auth.uid() and ja.team_id = public.evaluations.team_id)
  );
create policy "evaluations_update_own_judge" on public.evaluations
  for update using (judge_id = auth.uid()) with check (judge_id = auth.uid());
create policy "evaluations_select_team" on public.evaluations
  for select using (
    exists (select 1 from public.team_members tm where tm.team_id = public.evaluations.team_id and tm.user_id = auth.uid())
  );
create policy "evaluations_select_completed_hackathon" on public.evaluations
  for select using (
    exists (select 1 from public.hackathons h where h.id = public.evaluations.hackathon_id and h.status = 'completed')
  );
create policy "evaluations_admin_all" on public.evaluations
  for all using (is_admin()) with check (is_admin());

-- certificates ---------------------------------------------------------
create policy "certificates_select_own" on public.certificates
  for select using (user_id = auth.uid());
create policy "certificates_select_college" on public.certificates
  for select using (
    exists (
      select 1 from public.participant_profiles pp
      where pp.user_id = public.certificates.user_id and pp.college_name = public.my_college_name()
    )
  );
create policy "certificates_admin_all" on public.certificates
  for all using (is_admin()) with check (is_admin());

-- judge_assignments ---------------------------------------------------------
create policy "judge_assignments_select_own" on public.judge_assignments
  for select using (judge_id = auth.uid());
create policy "judge_assignments_admin_all" on public.judge_assignments
  for all using (is_admin()) with check (is_admin());

-- notifications ---------------------------------------------------------
create policy "notifications_select_own" on public.notifications
  for select using (user_id = auth.uid());
create policy "notifications_update_own" on public.notifications
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "notifications_admin_all" on public.notifications
  for all using (is_admin()) with check (is_admin());

-- announcements ---------------------------------------------------------
create policy "announcements_select_all" on public.announcements
  for select using (true);
create policy "announcements_admin_write" on public.announcements
  for all using (is_admin()) with check (is_admin());

-- winners ---------------------------------------------------------
create policy "winners_select_all" on public.winners
  for select using (true);
create policy "winners_admin_write" on public.winners
  for all using (is_admin()) with check (is_admin());
