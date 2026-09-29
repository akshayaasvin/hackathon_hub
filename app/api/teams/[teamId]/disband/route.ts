import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { apiSuccess, apiError } from '@/lib/apiResponse'
import { canModifyTeamMembership } from '@/lib/teamGuards'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Leader action (Phase 3, section 2/5): disband the whole team, confirmed client-side first.
// Deletes the team row (cascades team_members and team_invites for it — see migrations 0001,
// 0030), and resets every ex-member's registration back to 'approved'/team_id null so they can
// create or join another team, exactly like the "solo participant" scenario the task calls out
// by name.
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
    if (team.team_lead_id !== user.id) return apiError('Only the team leader can disband the team.', 403)

    const guard = await canModifyTeamMembership(admin, team.id, team.hackathon_id)
    if (!guard.ok) return apiError(guard.message, 400)

    const { data: members } = await admin.from('team_members').select('user_id').eq('team_id', team.id)
    const memberIds = (members ?? []).map((m) => m.user_id)

    const { error: deleteError } = await admin.from('teams').delete().eq('id', team.id)
    if (deleteError) throw deleteError

    if (memberIds.length > 0) {
      await admin
        .from('registrations')
        .update({ team_id: null, status: 'approved' })
        .eq('hackathon_id', team.hackathon_id)
        .in('user_id', memberIds)

      const others = memberIds.filter((id) => id !== user.id)
      if (others.length > 0) {
        await admin.from('notifications').insert(
          others.map((id) => ({
            user_id: id,
            title: 'Team disbanded',
            message: `"${team.team_name}" was disbanded by the team leader. You can create or join another team for this hackathon.`,
            type: 'team_invite',
          }))
        )
      }
    }

    return apiSuccess({}, `"${team.team_name}" has been disbanded.`)
  } catch (err: any) {
    console.error('[teams/disband] unhandled error:', err)
    return apiError('Something went wrong. Please try again.', 500)
  }
}
