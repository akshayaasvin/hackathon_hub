import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { apiSuccess, apiError } from '@/lib/apiResponse'
import { canModifyTeamMembership } from '@/lib/teamGuards'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Member action (Phase 3, section 3): leave a team you don't lead. The leader can't use this
// route (team_lead_id === user.id is rejected below) — they transfer leadership first, or
// disband the whole team via /disband.
export async function POST(_request: Request, { params }: { params: { teamId: string } }) {
  try {
    if (!UUID_RE.test(params.teamId)) return apiError('Team not found.', 404)

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return apiError('Not authenticated.', 401)

    const admin = createAdminClient()
    const { data: team, error: teamError } = await admin
      .from('teams')
      .select('id, team_name, hackathon_id, team_lead_id')
      .eq('id', params.teamId)
      .maybeSingle()
    if (teamError) throw teamError
    if (!team) return apiError('Team not found.', 404)
    if (team.team_lead_id === user.id) {
      return apiError('As the team leader, transfer leadership to someone else first, or disband the team.', 400)
    }

    const { data: membership } = await admin
      .from('team_members')
      .select('id')
      .eq('team_id', team.id)
      .eq('user_id', user.id)
      .maybeSingle()
    if (!membership) return apiError('You are not a member of this team.', 404)

    const guard = await canModifyTeamMembership(admin, team.id, team.hackathon_id)
    if (!guard.ok) return apiError(guard.message, 400)

    const { error: deleteError } = await admin.from('team_members').delete().eq('team_id', team.id).eq('user_id', user.id)
    if (deleteError) throw deleteError

    await admin
      .from('registrations')
      .update({ team_id: null, status: 'approved' })
      .eq('hackathon_id', team.hackathon_id)
      .eq('user_id', user.id)

    await admin.from('notifications').insert({
      user_id: team.team_lead_id,
      title: 'Member left',
      message: `${user.email} left "${team.team_name}".`,
      type: 'team_invite',
    })

    return apiSuccess({}, `You've left "${team.team_name}".`)
  } catch (err: any) {
    console.error('[teams/leave] unhandled error:', err)
    return apiError('Something went wrong. Please try again.', 500)
  }
}
