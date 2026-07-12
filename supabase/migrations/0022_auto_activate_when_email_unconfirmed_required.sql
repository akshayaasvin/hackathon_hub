-- Safety net for turning off Supabase Auth's project-level "Confirm email"
-- setting (Authentication -> Providers -> Email). The individual/participant
-- registration confirmation email participants never received was actually
-- Supabase Auth's own built-in signup-confirmation email, not a Resend
-- email — there's no app-code email call to remove, so the fix is
-- disabling that requirement at the project level instead.
--
-- Once confirmations are off, Supabase sets email_confirmed_at directly at
-- INSERT time on auth.users rather than via a later UPDATE. The existing
-- on_auth_email_confirmed trigger (0001_init.sql) only fires on UPDATE of
-- email_confirmed_at, so it would never run for these signups — a new
-- participant would be stuck at status='pending' forever with no
-- confirmation event left to flip it to 'active'.
--
-- This makes on_auth_user_created (0006, fires AFTER INSERT) check
-- email_confirmed_at itself at insert time and activate immediately when
-- it's already set. on_auth_email_confirmed stays in place, unchanged and
-- harmless, for any row where it's genuinely still null.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email, role, status)
  values (
    new.id,
    new.email,
    'participant',
    case when new.email_confirmed_at is not null then 'active' else 'pending' end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
