import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { apiSuccess, apiError } from '@/lib/apiResponse'
import { canModifyTeamMembership } from '@/lib/teamGuards'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Approved-or-later: a registration that has cleared admin review for this hackathon.
const APPROVED_OR_LATER = ['approved', 'team_created', 'submitted']

// Phase 1 (P0) fixed "User not found" by moving this lookup + every eligibility check
// server-side (see migration 0028 for the RLS root cause). Phase 3 (P1) changes what happens
// once eligibility passes: instead of adding the invitee straight to team_members, this
// creates a PENDING team_invites row — the invitee sees it on their Dashboard / notification
// bell and must Accept before they're actually on the team (app/api/team-invites/[id]/accept).
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
    const rawEmail = typeof body?.email === 'string' ? body.email : ''
    const email = rawEmail.trim().toLowerCase()
    if (!email) return apiError('Please enter an email address.', 400)

    const admin = createAdminClient()

    const { data: team, error: teamError } = await admin
      .from('teams')
      .select('id, team_name, hackathon_id, team_lead_id')
      .eq('id', params.teamId)
      .maybeSingle()
    if (teamError) throw teamError
    if (!team) return apiError('Team not found.', 404)
    if (team.team_lead_id !== user.id) return apiError('Only the team leader can invite members.', 403)

    const { data: hackathon, error: hackathonError } = await admin
      .from('hackathons')
      .select('id, name, max_team_size, deleted_at')
      .eq('id', team.hackathon_id)
      .maybeSingle()
    if (hackathonError) throw hackathonError
    if (!hackathon || hackathon.deleted_at) return apiError('This hackathon could not be found.', 404)

    const guard = await canModifyTeamMembership(admin, team.id, team.hackathon_id)
    if (!guard.ok) return apiError(guard.message, 400)

    // 1) Does an account with this email even exist? (lower(trim()) on both sides — see the
    // functional index added in migration 0028.)
    const { data: invitedUser, error: userError } = await admin
      .from('users')
      .select('id, full_name, email')
      .filter('email', 'ilike', email)
      .maybeSingle()
    if (userError) throw userError
    if (!invitedUser) return apiError('No account exists with that email address.', 404)
    if (invitedUser.id === user.id) return apiError('You cannot invite yourself.', 400)

    // 2) Registered AND approved (or further along) for THIS hackathon?
    const { data: invitedRegistration, error: regError } = await admin
      .from('registrations')
      .select('id, status, team_id')
      .eq('hackathon_id', team.hackathon_id)
      .eq('user_id', invitedUser.id)
      .maybeSingle()
    if (regError) throw regError
    if (!invitedRegistration || !APPROVED_OR_LATER.includes(invitedRegistration.status)) {
      return apiError(`${invitedUser.full_name || invitedUser.email} is not approved for this hackathon yet.`, 400)
    }

    // 3) Already in a team FOR THIS HACKATHON — this team or another one?
    if (invitedRegistration.team_id) {
      if (invitedRegistration.team_id === team.id) {
        return apiError(`${invitedUser.full_name || invitedUser.email} is already a member of this team.`, 409)
      }
      const { data: otherTeam } = await admin
        .from('teams')
        .select('team_name')
        .eq('id', invitedRegistration.team_id)
        .maybeSingle()
      return apiError(
        `${invitedUser.full_name || invitedUser.email} is already in another team for this hackathon ("${otherTeam?.team_name || 'Unknown'}").`,
        409
      )
    }

    // 4) Already invited (an open pending invite from this team)?
    const { data: existingInvite } = await admin
      .from('team_invites')
      .select('id')
      .eq('team_id', team.id)
      .eq('invited_user_id', invitedUser.id)
      .eq('status', 'pending')
      .maybeSingle()
    if (existingInvite) return apiError(`${invitedUser.full_name || invitedUser.email} already has a pending invite from this team.`, 409)

    // 5) Team capacity — counts confirmed members only; pending invites don't reserve a slot.
    const { count: memberCount, error: countError } = await admin
      .from('team_members')
      .select('id', { count: 'exact', head: true })
      .eq('team_id', team.id)
    if (countError) throw countError
    if ((memberCount ?? 0) >= hackathon.max_team_size) {
      return apiError(`This team is already at the maximum size (${hackathon.max_team_size}).`, 400)
    }

    const { data: invite, error: insertError } = await admin
      .from('team_invites')
      .insert({ team_id: team.id, hackathon_id: team.hackathon_id, invited_user_id: invitedUser.id, invited_by: user.id })
      .select('id')
      .single()
    if (insertError) throw insertError

    await admin.from('notifications').insert({
      user_id: invitedUser.id,
      title: 'Team invite',
      message: `You've been invited to join "${team.team_name}" for ${hackathon.name}. Accept or decline from your Dashboard.`,
      type: 'team_invite',
    })

    return apiSuccess({ inviteId: invite.id }, `Invite sent to ${invitedUser.full_name || invitedUser.email}.`)
  } catch (err: any) {
    console.error('[teams/invite] unhandled error:', err)
    return apiError('Something went wrong. Please try again.', 500)
  }
}
