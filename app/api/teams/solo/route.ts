import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { apiSuccess, apiError } from '@/lib/apiResponse'

// "Participate Solo" (P1, Team step option B.2): a real team of one, created automatically —
// no team name entered, displays the participant's own name, and is exempt from the
// case-insensitive unique-name index (migration 0032's partial index) since multiple
// participants can easily share a display name. Mirrors app/api/teams/route.ts's atomic
// team+membership creation, just without the name-availability check that route needs.
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
    if (!hackathonId) return apiError('Invalid request — expected { hackathonId }.', 400)

    const admin = createAdminClient()

    const { data: registration, error: regError } = await admin
      .from('registrations')
      .select('id, status')
      .eq('hackathon_id', hackathonId)
      .eq('user_id', user.id)
      .maybeSingle()
    if (regError) throw regError
    if (!registration) return apiError('You are not registered for this hackathon.', 404)
    if (registration.status !== 'approved') {
      return apiError(`Cannot start a team from status "${registration.status}". Waiting for admin approval.`, 400)
    }

    const { data: profile } = await admin.from('users').select('full_name, email').eq('id', user.id).maybeSingle()
    const displayName = profile?.full_name || profile?.email || 'Solo Participant'

    const { data: team, error: teamError } = await admin
      .from('teams')
      .insert({ team_name: displayName, hackathon_id: hackathonId, team_lead_id: user.id, is_solo: true })
      .select()
      .single()
    if (teamError || !team) {
      console.error('[teams/solo] team insert failed:', teamError)
      return apiError(teamError?.message || 'Could not start your solo entry.', 500)
    }

    const { error: memberError } = await admin.from('team_members').insert({ team_id: team.id, user_id: user.id })
    if (memberError) {
      console.error('[teams/solo] team_members insert failed, rolling back team:', memberError)
      await admin.from('teams').delete().eq('id', team.id)
      return apiError('Could not finish setting up your solo entry. Please try again.', 500)
    }

    const { error: statusError } = await admin
      .from('registrations')
      .update({ status: 'team_created', team_id: team.id })
      .eq('id', registration.id)
    if (statusError) console.error('[teams/solo] registration status update failed:', statusError)

    return apiSuccess({ team, status: 'team_created' }, "You're in as a solo participant.")
  } catch (err: any) {
    console.error('[teams/solo] unhandled error:', err)
    return apiError('Something went wrong. Please try again.', 500)
  }
}
