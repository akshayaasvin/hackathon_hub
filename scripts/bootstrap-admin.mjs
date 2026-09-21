// One-off helper: list, reset or create THE admin account (Supabase Auth + public.users).
//
// Supabase stores passwords as one-way hashes, so an existing admin password can't be
// "recovered" — it can only be reset. This script does that with the service-role key,
// which it reads from the environment (never from a file in the repo, never printed).
//
// Run from the project root (PowerShell), with your real values:
//
//   1) See who the admin(s) are:
//        node --env-file=.env.local scripts/bootstrap-admin.mjs
//
//   2) Reset that admin's password (or create the account if the email is new):
//        $env:ADMIN_EMAIL = "you@example.com"
//        $env:ADMIN_NEW_PASSWORD = "<a long random password, 12+ chars>"
//        node --env-file=.env.local scripts/bootstrap-admin.mjs
//
//   3) Optional, to enforce "exactly ONE admin": also set  $env:DEMOTE_OTHER_ADMINS = "1"
//      (other admin accounts become ordinary participants; nothing is deleted).
//
// Needs Node 20+ and the two variables below in .env.local.
import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !serviceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY (run with --env-file=.env.local).')
  process.exit(1)
}

const supabase = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })

const email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase()
const password = process.env.ADMIN_NEW_PASSWORD || ''

const { data: admins, error: listError } = await supabase
  .from('users')
  .select('id, email, full_name, status')
  .eq('role', 'admin')
if (listError) {
  console.error('Could not read public.users:', listError.message)
  process.exit(1)
}

console.log(admins.length ? 'Current admin account(s):' : 'No admin account exists yet.')
admins.forEach((a) => console.log(`  - ${a.email}  (status: ${a.status})`))

if (!email) {
  console.log('\nTo reset/create, set ADMIN_EMAIL and ADMIN_NEW_PASSWORD and run again (see the header of this file).')
  process.exit(0)
}
if (password.length < 12) {
  console.error('\nADMIN_NEW_PASSWORD must be at least 12 characters.')
  process.exit(1)
}

const { data: existing, error: lookupError } = await supabase.from('users').select('id').eq('email', email).maybeSingle()
if (lookupError) {
  console.error('Lookup failed:', lookupError.message)
  process.exit(1)
}

let userId = existing?.id
if (userId) {
  const { error } = await supabase.auth.admin.updateUserById(userId, { password, email_confirm: true })
  if (error) {
    console.error('Could not reset the password:', error.message)
    process.exit(1)
  }
  console.log(`\nPassword reset for ${email}.`)
} else {
  const { data, error } = await supabase.auth.admin.createUser({ email, password, email_confirm: true })
  if (error || !data.user) {
    console.error('Could not create the account:', error?.message)
    process.exit(1)
  }
  userId = data.user.id
  console.log(`\nCreated account ${email}.`)
}

// The on_auth_user_created trigger may already have inserted a placeholder row — upsert.
const { error: upsertError } = await supabase
  .from('users')
  .upsert({ id: userId, email, full_name: 'Admin', role: 'admin', status: 'active' }, { onConflict: 'id' })
if (upsertError) {
  console.error('Could not set role=admin:', upsertError.message)
  process.exit(1)
}
console.log(`${email} is now the active admin.`)

if (process.env.DEMOTE_OTHER_ADMINS === '1') {
  const others = admins.filter((a) => a.id !== userId)
  for (const o of others) {
    const { error } = await supabase.from('users').update({ role: 'participant' }).eq('id', o.id)
    console.log(error ? `  could not demote ${o.email}: ${error.message}` : `  demoted ${o.email} to participant`)
  }
}

console.log('\nSign in at https://hackathon.adz4needz.com/admin with that email and password.')
