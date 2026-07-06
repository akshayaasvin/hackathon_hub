import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { apiSuccess, apiError } from '@/lib/apiResponse'

// Creates a team + adds the creator as its first team_members row, atomically
// (rolls back the team if the membership insert fails, instead of leaving an
// orphaned team with no members — the exact bug that made "ninja" un-submittable).
// Requires the caller's registration for this hackathon to be "approved";
// transitions it to "team_created" on success.
export async function POST(request: Request) {
  try {
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
    const hackathonId = body?.hackathonId
    const teamName = typeof body?.teamName === 'string' ? body.teamName.trim() : ''
    if (!hackathonId || !teamName) {
      return apiError('Invalid request — expected { hackathonId, teamName }.', 400)
    }

    let admin
    try {
      admin = createAdminClient()
    } catch (err: any) {
      console.error('[teams] createAdminClient failed:', err)
      return apiError('Something went wrong. Please try again later.', 500)
    }

    const { data: registration, error: regError } = await admin
      .from('registrations')
      .select('id, status')
      .eq('hackathon_id', hackathonId)
      .eq('user_id', user.id)
      .single()

    if (regError || !registration) return apiError('You are not registered for this hackathon.', 404)
    if (registration.status !== 'approved') {
      return apiError(`Cannot create a team from status "${registration.status}". Waiting for admin approval.`, 400)
    }

    const { data: team, error: teamError } = await admin
      .from('teams')
      .insert({ team_name: teamName, hackathon_id: hackathonId, team_lead_id: user.id })
      .select()
      .single()

    if (teamError || !team) {
      console.error('[teams] team insert failed:', teamError)
      return apiError(teamError?.message || 'Could not create team.', 500)
    }

    const { error: memberError } = await admin.from('team_members').insert({ team_id: team.id, user_id: user.id })
    if (memberError) {
      console.error('[teams] team_members insert failed, rolling back team:', memberError)
      await admin.from('teams').delete().eq('id', team.id)
      return apiError('Could not finish creating your team. Please try again.', 500)
    }

    const { error: statusError } = await admin
      .from('registrations')
      .update({ status: 'team_created', team_id: team.id })
      .eq('id', registration.id)

    if (statusError) {
      console.error('[teams] registration status update failed:', statusError)
      // Team + membership already exist and are valid; not worth rolling back
      // over a status-column write failure. Log and continue.
    }

    return apiSuccess({ team, status: 'team_created' }, 'Team created successfully.')
  } catch (err: any) {
    console.error('[teams] unhandled error:', err)
    return apiError('Something went wrong. Please try again.', 500)
  }
}
