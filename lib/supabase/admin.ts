import 'server-only'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

/**
 * Service-role Supabase client. Bypasses RLS entirely — only import this
 * from server-only code (API routes, server actions). Never import from a
 * 'use client' component; the `server-only` import above will fail the
 * build if that happens.
 */
export const createAdminClient = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceRoleKey) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Add SUPABASE_SERVICE_ROLE_KEY to .env.local (Supabase Dashboard -> Project Settings -> API).'
    )
  }

  return createSupabaseClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    // Next.js 14 stores GET fetch() responses in its Data Cache — even on routes marked
    // `dynamic = 'force-dynamic'` — and supabase-js reads are plain GET fetches. Without
    // this, the first answer (e.g. "no webinars yet", or a registration still
    // 'payment_pending') is served again after the data changes. Payment state must
    // always be read live, so this client never uses the cache.
    global: { fetch: (input, init) => fetch(input, { ...init, cache: 'no-store' }) },
  })
}
