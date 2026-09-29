import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { apiSuccess, apiError } from '@/lib/apiResponse'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Leader action (Phase 3, section 2). Deliberately NOT gated by canModifyTeamMembership —
// changing who leads doesn't change who's ON the team, so it stays available even after
// Round 1 locks membership (a team still needs a leader able to act for it in later rounds).
export async function POST(request: Request, { params }: { params: { teamId: string } }) {
  try {
    if (!UUID_RE.test(params.teamId)) return apiError('Team not found.', 404)

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return apiError('Not authenticated.', 401)

    let body: any
    try {
      body = await request.json()
    } catch {
      return apiError('Invalid request body — expected JSON.', 400)
    }
    const newLeaderId = typeof body?.newLeaderId === 'string' ? body.newLeaderId : ''
    if (!UUID_RE.test(newLeaderId)) return apiError('Invalid member.', 400)

    const admin = createAdminClient()
    const { data: team, error: teamError } = await admin.from('teams').select('id, team_name, team_lead_id').eq('id', params.teamId).maybeSingle()
    if (teamError) throw teamError
    if (!team) return apiError('Team not found.', 404)
    if (team.team_lead_id !== user.id) return apiError('Only the current team leader can transfer leadership.', 403)
    if (newLeaderId === user.id) return apiError('That person is already the team leader.', 400)

    const { data: membership } = await admin
      .from('team_members')
      .select('id')
      .eq('team_id', team.id)
      .eq('user_id', newLeaderId)
      .maybeSingle()
    if (!membership) return apiError('That person is not a member of this team.', 404)

    const { error: updateError } = await admin.from('teams').update({ team_lead_id: newLeaderId }).eq('id', team.id)
    if (updateError) throw updateError

    await admin.from('notifications').insert({
      user_id: newLeaderId,
      title: 'You are now the team leader',
      message: `You are now the leader of "${team.team_name}".`,
      type: 'team_invite',
    })

    return apiSuccess({}, 'Leadership transferred.')
  } catch (err: any) {
    console.error('[teams/transfer-leadership] unhandled error:', err)
    return apiError('Something went wrong. Please try again.', 500)
  }
}
