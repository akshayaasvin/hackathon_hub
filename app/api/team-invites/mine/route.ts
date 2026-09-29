import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { apiSuccess, apiError } from '@/lib/apiResponse'

export const dynamic = 'force-dynamic'

// The current user's own PENDING invites, across all hackathons — used by the participant
// Dashboard (Phase 3, section 1: "Invitee sees it in notifications + Dashboard with
// Accept/Decline"). Service-role because it joins in the team name and hackathon name, which
// the invitee's own RLS has no reason to be able to read for a team they're not on yet.
export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return apiError('Not authenticated.', 401)

    const admin = createAdminClient()
    const { data, error } = await admin
      .from('team_invites')
      .select('id, created_at, team:teams(id, team_name), hackathon:hackathons(id, name)')
      .eq('invited_user_id', user.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
    if (error) throw error

    return apiSuccess({ invites: data ?? [] })
  } catch (err) {
    console.error('[team-invites/mine] failed:', err)
    return apiError('Could not load your invites.', 500)
  }
}
