-- Indexes for the admin registration-management pages' new date-range filter and
-- pagination (internship-registrations / webinar-registrations): both now query
-- `created_at desc` combined with the internship/webinar selector, so a plain b-tree on
-- created_at alone isn't enough to keep those queries fast once a single internship/webinar
-- accumulates thousands of registrations.

create index if not exists internship_registrations_created_at_idx
  on public.internship_registrations (created_at desc);

create index if not exists internship_registrations_internship_id_created_at_idx
  on public.internship_registrations (internship_id, created_at desc);

create index if not exists webinar_registrations_created_at_idx
  on public.webinar_registrations (created_at desc);

create index if not exists webinar_registrations_webinar_id_created_at_idx
  on public.webinar_registrations (webinar_id, created_at desc);
