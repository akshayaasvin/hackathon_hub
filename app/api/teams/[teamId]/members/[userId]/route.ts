import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { apiSuccess, apiError } from '@/lib/apiResponse'
import { canModifyTeamMembership } from '@/lib/teamGuards'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Leader removes a member (Phase 3, section 2). Not for removing yourself — see /leave and
// /disband for the two ways a person's own membership can end. POST rather than DELETE to
// match every other action route in this app (all called via lib/apiFetch.ts's postJson,
// which always sends POST).
export async function POST(_request: Request, { params }: { params: { teamId: string; userId: string } }) {
  try {
    if (!UUID_RE.test(params.teamId) || !UUID_RE.test(params.userId)) return apiError('Not found.', 404)

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
    if (team.team_lead_id !== user.id) return apiError('Only the team leader can remove a member.', 403)
    if (params.userId === user.id) return apiError('Use "Disband team" to remove yourself as leader, or transfer leadership first.', 400)

    const guard = await canModifyTeamMembership(admin, team.id, team.hackathon_id)
    if (!guard.ok) return apiError(guard.message, 400)

    const { data: membership } = await admin
      .from('team_members')
      .select('id')
      .eq('team_id', team.id)
      .eq('user_id', params.userId)
      .maybeSingle()
    if (!membership) return apiError('That person is not a member of this team.', 404)

    const { error: deleteError } = await admin.from('team_members').delete().eq('team_id', team.id).eq('user_id', params.userId)
    if (deleteError) throw deleteError

    await admin
      .from('registrations')
      .update({ team_id: null, status: 'approved' })
      .eq('hackathon_id', team.hackathon_id)
      .eq('user_id', params.userId)

    await admin.from('notifications').insert({
      user_id: params.userId,
      title: 'Removed from team',
      message: `You were removed from "${team.team_name}". You can create or join another team for this hackathon.`,
      type: 'team_invite',
    })

    return apiSuccess({}, 'Member removed.')
  } catch (err: any) {
    console.error('[teams/members/remove] unhandled error:', err)
    return apiError('Something went wrong. Please try again.', 500)
  }
}
