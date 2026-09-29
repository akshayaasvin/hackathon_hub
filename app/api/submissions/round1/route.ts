import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { apiSuccess, apiError } from '@/lib/apiResponse'
import { validatePresentationUrl } from '@/lib/roundSubmissions'

// Round 1 submission (Phase 4, section A): a PPT LINK only — no file upload, no Storage
// bucket. Team leader submits/edits until hackathons.round1_deadline, then it locks. Judges
// and admins only ever open this link in a new tab (never embed/iframe it) — see the
// shortlist UI, app/admin/hackathons/[id]/round1/page.tsx.
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
    const rawUrl = typeof body?.presentationUrl === 'string' ? body.presentationUrl : ''
    if (!hackathonId) return apiError('Invalid request.', 400)

    const validated = validatePresentationUrl(rawUrl)
    if (validated.ok === false) return apiError(validated.message, 400, { presentationUrl: validated.message })

    const admin = createAdminClient()
    const { data: registration, error: regError } = await admin
      .from('registrations')
      .select('id, status, team_id')
      .eq('hackathon_id', hackathonId)
      .eq('user_id', user.id)
      .maybeSingle()
    if (regError) throw regError
    if (!registration || !registration.team_id) return apiError('You do not have a team for this hackathon.', 404)

    const { data: team, error: teamError } = await admin
      .from('teams')
      .select('id, team_lead_id')
      .eq('id', registration.team_id)
      .maybeSingle()
    if (teamError) throw teamError
    if (!team) return apiError('Team not found.', 404)
    if (team.team_lead_id !== user.id) return apiError('Only the team leader can submit the presentation link.', 403)

    const { data: hackathon, error: hackathonError } = await admin
      .from('hackathons')
      .select('round1_deadline')
      .eq('id', hackathonId)
      .maybeSingle()
    if (hackathonError) throw hackathonError
    if (hackathon?.round1_deadline && new Date(hackathon.round1_deadline).getTime() < Date.now()) {
      return apiError('The Round 1 deadline has passed — the presentation link is locked.', 400)
    }

    const now = new Date().toISOString()
    const { data: submission, error: submissionError } = await admin
      .from('submissions')
      .upsert(
        {
          team_id: team.id,
          hackathon_id: hackathonId,
          round: 1,
          presentation_url: validated.url,
          status: 'submitted',
          submitted_at: now,
        },
        { onConflict: 'team_id,round' }
      )
      .select()
      .single()
    if (submissionError) throw submissionError

    return apiSuccess({ submission }, 'Presentation link submitted.')
  } catch (err) {
    console.error('[submissions/round1] unhandled error:', err)
    return apiError('Something went wrong. Please try again.', 500)
  }
}
