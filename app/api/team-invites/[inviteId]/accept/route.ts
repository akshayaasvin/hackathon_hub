import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { apiSuccess, apiError } from '@/lib/apiResponse'
import { canModifyTeamMembership } from '@/lib/teamGuards'

// A response shape distinct from the standard { success, message } envelope, used only for
// the "you're already on a team — leave it to join this one?" prompt: the client needs
// structured data (which team, whether leaving it means disbanding) to build that prompt,
// which doesn't belong in apiError's fieldErrors (that's for per-input-field messages).
function alreadyOnTeamResponse(message: string, currentTeamId: string, currentTeamName: string, isSoloLeader: boolean) {
  return NextResponse.json(
    { success: false, message, code: 'ALREADY_ON_TEAM', currentTeamId, currentTeamName, isSoloLeader },
    { status: 409, headers: { 'Cache-Control': 'no-store' } }
  )
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Accepting an invite (Phase 3, section 1). If the invitee is already on a DIFFERENT team for
// this hackathon, this does NOT silently move them — it returns a distinct error the client
// recognizes (message starts with "ALREADY_ON_TEAM:") so the UI can prompt "Leave <team> to
// join?" and only re-call this route with forceLeaveCurrent: true once the person confirms.
export async function POST(request: Request, { params }: { params: { inviteId: string } }) {
  try {
    if (!UUID_RE.test(params.inviteId)) return apiError('Invite not found.', 404)

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return apiError('Not authenticated.', 401)

    let body: any = {}
    try {
      body = await request.json()
    } catch {
      // no body is fine — forceLeaveCurrent defaults to false
    }
    const forceLeaveCurrent = body?.forceLeaveCurrent === true

    const admin = createAdminClient()

    const { data: invite, error: inviteError } = await admin
      .from('team_invites')
      .select('id, team_id, hackathon_id, invited_user_id, status')
      .eq('id', params.inviteId)
      .maybeSingle()
    if (inviteError) throw inviteError
    if (!invite) return apiError('Invite not found.', 404)
    if (invite.invited_user_id !== user.id) return apiError('This invite is not addressed to you.', 403)
    if (invite.status !== 'pending') return apiError(`This invite has already been ${invite.status}.`, 409)

    const { data: team, error: teamError } = await admin
      .from('teams')
      .select('id, team_name, hackathon_id, team_lead_id')
      .eq('id', invite.team_id)
      .maybeSingle()
    if (teamError) throw teamError
    if (!team) return apiError('This team no longer exists.', 404)

    const guard = await canModifyTeamMembership(admin, team.id, team.hackathon_id)
    if (!guard.ok) return apiError(guard.message, 400)

    const { data: registration, error: regError } = await admin
      .from('registrations')
      .select('id, team_id')
      .eq('hackathon_id', invite.hackathon_id)
      .eq('user_id', user.id)
      .maybeSingle()
    if (regError) throw regError
    if (!registration) return apiError('You are not registered for this hackathon.', 404)

    // Already on a (different) team for this hackathon?
    if (registration.team_id && registration.team_id !== team.id) {
      const { data: currentTeam } = await admin
        .from('teams')
        .select('id, team_name, team_lead_id, is_solo')
        .eq('id', registration.team_id)
        .maybeSingle()

      if (currentTeam) {
        // A real solo team (created via "Participate Solo"), not a heuristic based on member
        // count — a leader-created team that just happens to have no other members yet is a
        // deliberate choice the leader made and is never silently auto-disbanded.
        const isSoloLeader = currentTeam.team_lead_id === user.id && currentTeam.is_solo === true

        if (!forceLeaveCurrent) {
          return alreadyOnTeamResponse(
            `You're already in "${currentTeam.team_name}" for this hackathon. Leave it to join "${team.team_name}"?`,
            currentTeam.id,
            currentTeam.team_name,
            isSoloLeader
          )
        }

        if (currentTeam.team_lead_id === user.id && !isSoloLeader) {
          return apiError(
            `You lead "${currentTeam.team_name}" which has other members — transfer leadership or disband it from Manage Team before accepting a new invite.`,
            400
          )
        }

        const currentGuard = await canModifyTeamMembership(admin, currentTeam.id, team.hackathon_id)
        if (!currentGuard.ok) return apiError(`Could not leave "${currentTeam.team_name}": ${currentGuard.message}`, 400)

        if (isSoloLeader) {
          // Disbanding your own solo team is exactly what leaving it means here — no other
          // member is left behind. Cascades team_members/team_invites for it.
          await admin.from('teams').delete().eq('id', currentTeam.id)
        } else {
          await admin.from('team_members').delete().eq('team_id', currentTeam.id).eq('user_id', user.id)
        }
      }
    }

    const { error: memberError } = await admin.from('team_members').insert({ team_id: team.id, user_id: user.id })
    if (memberError) {
      if ((memberError as any).code === '23505') return apiError('You are already in a team for this hackathon.', 409)
      throw memberError
    }

    await admin
      .from('team_invites')
      .update({ status: 'accepted', responded_at: new Date().toISOString() })
      .eq('id', invite.id)
    // Any other still-pending invite to this same person for THIS hackathon (from a different
    // team) no longer makes sense once they've joined one — leave it visible as pending would
    // be misleading, but it isn't automatically declined here to avoid surprising whoever sent
    // it; the accepting team's leader can see membership updated live instead.

    await admin
      .from('registrations')
      .update({ team_id: team.id, status: 'team_created' })
      .eq('id', registration.id)

    const { data: acceptedBy } = await admin.from('users').select('full_name, email').eq('id', user.id).maybeSingle()
    await admin.from('notifications').insert({
      user_id: team.team_lead_id,
      title: 'Invite accepted',
      message: `${acceptedBy?.full_name || acceptedBy?.email || 'A member'} accepted your invite and joined "${team.team_name}".`,
      type: 'team_invite',
    })

    return apiSuccess({ teamId: team.id, teamName: team.team_name }, `You've joined "${team.team_name}".`)
  } catch (err: any) {
    console.error('[team-invites/accept] unhandled error:', err)
    return apiError('Something went wrong. Please try again.', 500)
  }
}
