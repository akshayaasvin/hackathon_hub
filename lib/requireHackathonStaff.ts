import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Admin (any hackathon), or a jury account assigned to THIS specific hackathon (via
 * judge_assignments) — used by every Round 1/Round 2 scoring and shortlist route (Phase 4:
 * "Judges can score and mark attendance for hackathons they're assigned to"). Session identity
 * comes from the caller's own cookie-based client (never trust a body/query param for who's
 * asking); the role/assignment lookup itself uses the service-role client, same reasoning as
 * lib/requireAdmin.ts — bypassing RLS here is deliberate, not a gap, since this IS the
 * authorization check the rest of the route then relies on.
 */
export async function requireAdminOrAssignedJudge(hackathonId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const admin = createAdminClient()
  const { data: userData } = await admin.from('users').select('role, status').eq('id', user.id).maybeSingle()
  if (!userData || userData.status !== 'active') return null
  if (userData.role === 'admin') return { user, isAdmin: true as const }
  if (userData.role === 'jury') {
    const { data: assignment } = await admin
      .from('judge_assignments')
      .select('id')
      .eq('judge_id', user.id)
      .eq('hackathon_id', hackathonId)
      .limit(1)
      .maybeSingle()
    if (assignment) return { user, isAdmin: false as const }
  }
  return null
}
