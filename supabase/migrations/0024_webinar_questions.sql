-- Admin-defined registration questions ("Google Form" style) for webinars.
--
--  * webinars.questions             the question list the admin builds; public page renders it
--  * webinar_registrations.answers  the registrant's answers, stored as a SNAPSHOT
--                                   ([{id,label,type,value}]) so editing or deleting a
--                                   question later never rewrites what people already answered
--
-- Name, email and phone stay as fixed columns: they drive duplicate protection,
-- the Razorpay prefill and the confirmation email.

alter table public.webinars
  add column if not exists questions jsonb not null default '[]'::jsonb;

alter table public.webinar_registrations
  add column if not exists answers jsonb not null default '[]'::jsonb;
