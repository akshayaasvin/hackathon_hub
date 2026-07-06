-- Safety net for orphaned auth.users rows (an account exists in Supabase Auth but
-- has no corresponding public.users row — seen twice now, most likely a dropped
-- request between signUp()/createUser() succeeding and the app's own insert into
-- public.users running, e.g. a network interruption or serverless cold-start).
--
-- This trigger auto-creates a minimal public.users row (role='participant',
-- status='pending') the moment ANY new auth.users row appears, regardless of which
-- Supabase Auth API created it (signUp, admin.createUser, etc.) or what the app's
-- own follow-up code does afterward. Falling back to 'participant'/'pending' is
-- deliberate: it pairs with the existing on_auth_email_confirmed trigger (0001),
-- which already auto-activates any role='participant' status='pending' row on
-- email confirmation — so even if the rest of a registration request never runs,
-- the account still becomes usable once the email is confirmed, just missing
-- profile details the person can fill in from their profile page.
--
-- Because this can now create the row before the application code does, every
-- place that inserts into public.users must upsert instead (see the three API
-- routes updated alongside this migration), or they'd hit a duplicate-key error.

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email, role, status)
  values (new.id, new.email, 'participant', 'pending')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();
