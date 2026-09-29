import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { apiSuccess, apiError } from '@/lib/apiResponse'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function POST(_request: Request, { params }: { params: { inviteId: string } }) {
  try {
    if (!UUID_RE.test(params.inviteId)) return apiError('Invite not found.', 404)

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return apiError('Not authenticated.', 401)

    const admin = createAdminClient()
    const { data: invite, error: inviteError } = await admin
      .from('team_invites')
      .select('id, invited_user_id, status, team_id')
      .eq('id', params.inviteId)
      .maybeSingle()
    if (inviteError) throw inviteError
    if (!invite) return apiError('Invite not found.', 404)
    if (invite.invited_user_id !== user.id) return apiError('This invite is not addressed to you.', 403)
    if (invite.status !== 'pending') return apiError(`This invite has already been ${invite.status}.`, 409)

    await admin.from('team_invites').update({ status: 'declined', responded_at: new Date().toISOString() }).eq('id', invite.id)

    const { data: team } = await admin.from('teams').select('team_name, team_lead_id').eq('id', invite.team_id).maybeSingle()
    if (team?.team_lead_id) {
      await admin.from('notifications').insert({
        user_id: team.team_lead_id,
        title: 'Invite declined',
        message: `${user.email} declined your invite to join "${team.team_name}".`,
        type: 'team_invite',
      })
    }

    return apiSuccess({}, 'Invite declined.')
  } catch (err: any) {
    console.error('[team-invites/decline] unhandled error:', err)
    return apiError('Something went wrong. Please try again.', 500)
  }
}
