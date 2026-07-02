# HackathonHub

Next.js 14 (App Router) + TypeScript + Supabase platform for running hackathons: student/college/jury
registration with admin approval, team formation, project submission, jury evaluation, results, and
verifiable certificates.

## Environment variables (`.env.local`)

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

1. **Run the schema migration.** Paste `supabase/migrations/0001_init.sql` into the Supabase SQL editor
   (or `supabase db push` if you have the CLI linked) and run it. This creates every table, the
   `is_admin()`/`my_college_name()` helper functions, the auto-activation trigger, and all RLS policies.
2. **(Optional) Seed a sample hackathon.** Run `supabase/seed.sql` the same way.
3. **Enable email confirmation.** In Supabase Dashboard → Authentication → Providers → Email, make sure
   "Confirm email" is **ON**. This can't be set via SQL — participants rely on it to auto-activate, and
   college/jury applicants need it before admin approval.
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
- **Registration**: `app/api/auth/register/route.ts` handles all three roles. Participants activate
  automatically on email confirmation (via a Postgres trigger). College/jury applicants land in `pending`
  status and are blocked from their dashboard by `middleware.ts` until an admin approves them via
  `/admin/approvals`, which calls `app/api/admin/approvals/route.ts`.
- **RLS**: every table has Row Level Security enabled — see `supabase/migrations/0001_init.sql` for the
  full policy set (admin full access, participants scoped to their own data, colleges scoped to students
  sharing their `college_name`, jury scoped to teams they're assigned via `judge_assignments`).
- **No AI API keys required.** Nothing in this app calls an LLM.

## Deploying to Vercel

Set all five env vars above in the Vercel project settings (Production + Preview). No other config is
required — `npm run build` is the standard Next.js build command.
