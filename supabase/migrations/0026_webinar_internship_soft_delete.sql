-- Soft delete for webinars and internships — same pattern as hackathons (0013).
--
-- webinar_registrations.webinar_id and internship_registrations.internship_id are both
-- `on delete restrict` (0023, 0025): a real SQL DELETE would either be refused outright (any
-- registration exists) or, if the FK were cascade instead, silently wipe registration/payment
-- history. Neither is acceptable — payment records in particular must survive for accounting
-- and Razorpay reconciliation. deleted_at set means "hidden from every list", not "gone".
alter table public.webinars add column if not exists deleted_at timestamptz;
alter table public.internships add column if not exists deleted_at timestamptz;
