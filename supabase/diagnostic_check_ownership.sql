-- Run this in the Supabase SQL editor and paste back the full result.
-- Diagnoses why security-definer RLS helper functions aren't bypassing RLS.

select 'table ownership' as check, n.nspname as schema, c.relname as name, pg_get_userbyid(c.relowner) as owner
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where c.relname in ('users', 'participant_profiles', 'college_profiles', 'team_members')
  and n.nspname = 'public'

union all

select 'function ownership', 'public', proname, pg_get_userbyid(proowner) || ' (security definer: ' || prosecdef || ')'
from pg_proc
where proname in ('is_admin', 'my_college_name', 'is_in_team')
  and pronamespace = 'public'::regnamespace

union all

select 'role bypassrls', '-', rolname, rolbypassrls::text || ' (super: ' || rolsuper || ')'
from pg_roles
where rolname in ('postgres', 'service_role', 'authenticated', 'anon', 'supabase_admin')

union all

select 'current execution role', '-', current_user, session_user;
