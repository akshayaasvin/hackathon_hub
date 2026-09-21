import 'server-only'
import { createClient } from '@/lib/supabase/server'

/**
 * Returns the signed-in user when they are an ACTIVE admin, otherwise null.
 * Mirrors the check the existing /api/admin/* routes each define inline.
 */
export async function requireAdmin() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  const { data: userData } = await supabase.from('users').select('role, status').eq('id', user.id).single()
  if (userData?.role !== 'admin' || userData?.status !== 'active') return null
  return user
}
