# HackathonHub

Next.js 14 (App Router) + TypeScript + Supabase platform for running hackathons: student/college/jury
registration with admin approval, team formation, project submission, jury evaluation, results, and
verifiable certificates.

## Environment variables (`.env.local`, see `.env.example`)

| Variable | Where to get it | Exposed to browser? |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Dashboard → Project Settings → API → Project URL | Yes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase Dashboard → Project Settings → API → `anon` `public` key | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Dashboard → Project Settings → API → `service_role` key | **No — server-only.** Never add a `NEXT_PUBLIC_` prefix to this. Used only inside `lib/supabase/admin.ts` and the `app/api/**` routes that import it. |
| `RESEND_API_KEY` | [resend.com/api-keys](https://resend.com/api-keys) after creating a free account | No — server-only |
| `RESEND_FROM_EMAIL` | Any address on a domain you've verified with Resend, or `onboarding@resend.dev` for testing | No — server-only |

If `RESEND_API_KEY` is unset, `lib/email.ts` logs a warning and skips sending — approval/rejection still
works, the applicant just won't get an email (check server logs for the generated password).

## One-time Supabase setup

1. **Run the schema migrations, in order.** Paste `supabase/migrations/0001_init.sql` then
   `supabase/migrations/0002_applications.sql` into the Supabase SQL editor (or `supabase db push` if
   you have the CLI linked). `0001` creates the core schema, `is_admin()`/`my_college_name()` helpers,
   the participant auto-activation trigger, and all RLS policies. `0002` adds the `college_applications`/
   `jury_applications` staging tables that back the approval workflow (see Architecture notes below) and
   drops the now-redundant `approved_by`/`approved_at` columns from `college_profiles`/`jury_profiles`.
2. **(Optional) Seed a sample hackathon.** Run `supabase/seed.sql` the same way.
3. **"Confirm email" (Authentication → Providers → Email) no longer matters for this app.**
   Participant registration creates the account via the admin API with `email_confirm: true`
   (see `app/api/auth/register`), so no confirmation email is ever sent and this setting is
   never consulted for that flow. College/jury accounts are also created via the admin API
   (on admin approval), so the setting has no effect there either. You can leave it on or off —
   nothing in the app depends on it.
4. **Create your first admin.** There's no self-serve admin signup. Register normally as a participant,
   then in the Supabase SQL editor run:
   ```sql
   update public.users set role = 'admin', status = 'active' where email = 'you@example.com';
   ```

## Local development

```bash
npm install
npm run dev
```

## Architecture notes

- **Auth**: real Supabase Auth only — no mock/localStorage auth system. `lib/supabase/client.ts` and
  `lib/supabase/server.ts` are thin wrappers; `lib/supabase/admin.ts` is a service-role client that is
  never imported from client components (enforced by the `server-only` package).
- **Registration**: `app/api/auth/register/route.ts` handles all three roles, but only **participants**
  get a Supabase Auth account at registration time (activates automatically on email confirmation via a
  Postgres trigger). **College and jury submissions never touch `auth.users` at registration** — they're
  stored in the `college_applications`/`jury_applications` staging tables with `status='pending'`, and
  no login exists for them at all yet. Resubmitting with the same email after a rejection or a
  "changes requested" note updates the existing row instead of creating a duplicate.
- **Approval**: `/admin/approvals` (`app/api/admin/approvals/route.ts`) is the *only* place a college/jury
  auth account, `users` row, and profile row get created — and only on Approve. Reject leaves no account
  behind at all (nothing to clean up). Request Changes emails the applicant a note and waits for them to
  resubmit; it never touches `auth.users`.
- **RLS**: every table has Row Level Security enabled — see `supabase/migrations/0001_init.sql` for the
  full policy set (admin full access, participants scoped to their own data, colleges scoped to students
  sharing their `college_name`, jury scoped to teams they're assigned via `judge_assignments`).
- **No AI API keys required.** Nothing in this app calls an LLM.

## Deploying to Vercel

Set all five env vars above in the Vercel project settings (Production + Preview). No other config is
required — `npm run build` is the standard Next.js build command.
