import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { apiSuccess, apiError } from '@/lib/apiResponse'

export const dynamic = 'force-dynamic'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// P0 fix: pending invites for a team, with the INVITEE's name/email resolved server-side.
// The leader's Manage Team modal used to look this up with two direct client-side queries —
// `.from('users').select(...).in('id', ...)` for the invitee's own row, which the leader's own
// RLS session can never see (same root cause as migration 0028: a participant cannot read
// another user's row via RLS, full stop) — so it silently came back empty and rendered
// "Unknown" for every single invite, not just some.
export async function GET(_request: Request, { params }: { params: { teamId: string } }) {
  try {
    if (!UUID_RE.test(params.teamId)) return apiError('Team not found.', 404)

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return apiError('Not authenticated.', 401)

    const admin = createAdminClient()
    const { data: team, error: teamError } = await admin.from('teams').select('id, team_lead_id').eq('id', params.teamId).maybeSingle()
    if (teamError) throw teamError
    if (!team) return apiError('Team not found.', 404)
    if (team.team_lead_id !== user.id) return apiError('Only the team leader can view pending invites.', 403)

    const { data: invites, error: invitesError } = await admin
      .from('team_invites')
      .select('id, invited_user_id, created_at')
      .eq('team_id', team.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
    if (invitesError) throw invitesError

    let withInvitee: any[] = []
    if (invites && invites.length > 0) {
      const { data: invitedUsers, error: usersError } = await admin
        .from('users')
        .select('id, full_name, email')
        .in('id', invites.map((i) => i.invited_user_id))
      if (usersError) throw usersError
      withInvitee = invites.map((i) => ({ ...i, invitee: invitedUsers?.find((u) => u.id === i.invited_user_id) ?? null }))
    }

    return apiSuccess({ invites: withInvitee })
  } catch (err) {
    console.error('[teams/invites] failed:', err)
    return apiError('Could not load pending invites.', 500)
  }
}
