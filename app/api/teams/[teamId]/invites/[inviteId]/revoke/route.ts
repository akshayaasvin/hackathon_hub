import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { apiSuccess, apiError } from '@/lib/apiResponse'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function POST(_request: Request, { params }: { params: { teamId: string; inviteId: string } }) {
  try {
    if (!UUID_RE.test(params.teamId) || !UUID_RE.test(params.inviteId)) return apiError('Not found.', 404)

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return apiError('Not authenticated.', 401)

    const admin = createAdminClient()
    const { data: team, error: teamError } = await admin.from('teams').select('id, team_lead_id').eq('id', params.teamId).maybeSingle()
    if (teamError) throw teamError
    if (!team) return apiError('Team not found.', 404)
    if (team.team_lead_id !== user.id) return apiError('Only the team leader can revoke an invite.', 403)

    const { data: invite, error: inviteError } = await admin
      .from('team_invites')
      .select('id, team_id, status, invited_user_id')
      .eq('id', params.inviteId)
      .maybeSingle()
    if (inviteError) throw inviteError
    if (!invite || invite.team_id !== team.id) return apiError('Invite not found.', 404)
    if (invite.status !== 'pending') return apiError(`This invite has already been ${invite.status}.`, 409)

    await admin.from('team_invites').update({ status: 'revoked', responded_at: new Date().toISOString() }).eq('id', invite.id)

    return apiSuccess({}, 'Invite revoked.')
  } catch (err: any) {
    console.error('[teams/invites/revoke] unhandled error:', err)
    return apiError('Something went wrong. Please try again.', 500)
  }
}
