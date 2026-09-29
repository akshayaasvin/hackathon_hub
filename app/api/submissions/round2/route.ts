import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { apiSuccess, apiError } from '@/lib/apiResponse'
import { validateGithubUrl, validateLiveDemoUrl, validateOptionalVideoUrl } from '@/lib/roundSubmissions'

// Round 2 submission (Phase 4, "Round 2 — Demo submission"): shortlisted teams only, enforced
// HERE (not just hidden in the UI) — a non-shortlisted team's request is rejected regardless
// of what the client sends, matching Phase 4's own "Enforce in RLS and server action too, not
// just UI" instruction (RLS additionally blocks a shortlisted check leaking any OTHER team's
// row — this route only ever touches the caller's own team).
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
    if (!hackathonId) return apiError('Invalid request.', 400)

    const githubUrl = validateGithubUrl(typeof body?.githubUrl === 'string' ? body.githubUrl : '')
    const liveDemoUrl = validateLiveDemoUrl(typeof body?.liveDemoUrl === 'string' ? body.liveDemoUrl : '')
    const videoUrl = validateOptionalVideoUrl(typeof body?.videoUrl === 'string' ? body.videoUrl : '')
    const fieldErrors: Record<string, string> = {}
    if (githubUrl.ok === false) fieldErrors.githubUrl = githubUrl.message
    if (liveDemoUrl.ok === false) fieldErrors.liveDemoUrl = liveDemoUrl.message
    if (videoUrl.ok === false) fieldErrors.videoUrl = videoUrl.message
    if (Object.keys(fieldErrors).length > 0) return apiError('Please fix the highlighted fields.', 400, fieldErrors)
    const notes = typeof body?.notes === 'string' ? body.notes.trim().slice(0, 5000) : null

    const admin = createAdminClient()
    const { data: registration, error: regError } = await admin
      .from('registrations')
      .select('id, team_id')
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
    if (team.team_lead_id !== user.id) return apiError('Only the team leader can submit for Round 2.', 403)

    const { data: hackathon, error: hackathonError } = await admin
      .from('hackathons')
      .select('round2_deadline')
      .eq('id', hackathonId)
      .maybeSingle()
    if (hackathonError) throw hackathonError
    if (hackathon?.round2_deadline && new Date(hackathon.round2_deadline).getTime() < Date.now()) {
      return apiError('The Round 2 deadline has passed — submissions are locked.', 400)
    }

    // The actual gate: was this team shortlisted in Round 1? Read here with the service-role
    // client on purpose — RLS on team_round_status hides this row from the team until Round 1
    // results are published, which is exactly the state a non-shortlisted team is in
    // (round1 published, shortlisted=false) and also the state BEFORE publish (row may exist
    // but the team can't see it) — this check bypasses that visibility gate to make the actual
    // decision, then the response is a plain yes/no, never the row's other contents.
    const { data: roundStatus } = await admin
      .from('team_round_status')
      .select('shortlisted')
      .eq('team_id', team.id)
      .eq('round', 1)
      .maybeSingle()
    if (!roundStatus?.shortlisted) {
      return apiError('Your team was not shortlisted for Round 2.', 403)
    }

    const now = new Date().toISOString()
    const { data: submission, error: submissionError } = await admin
      .from('submissions')
      .upsert(
        {
          team_id: team.id,
          hackathon_id: hackathonId,
          round: 2,
          repo_link: githubUrl.ok ? githubUrl.url : null,
          live_demo_url: liveDemoUrl.ok ? liveDemoUrl.url : null,
          demo_video_url: videoUrl.ok ? videoUrl.url || null : null,
          notes,
          status: 'submitted',
          submitted_at: now,
        },
        { onConflict: 'team_id,round' }
      )
      .select()
      .single()
    if (submissionError) throw submissionError

    return apiSuccess({ submission }, 'Round 2 submission received.')
  } catch (err) {
    console.error('[submissions/round2] unhandled error:', err)
    return apiError('Something went wrong. Please try again.', 500)
  }
}
