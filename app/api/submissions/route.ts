import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { apiSuccess, apiError } from '@/lib/apiResponse'

// Requires the caller's registration for this hackathon to be "team_created"
// (or already "submitted", to allow editing/resubmitting). Upserts the team's
// submission row and transitions the registration to "submitted".
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
    const projectTitle = typeof body?.project_title === 'string' ? body.project_title.trim() : ''
    if (!hackathonId || !projectTitle) {
      return apiError('Invalid request — expected { hackathonId, project_title, ... }.', 400)
    }

    let admin
    try {
      admin = createAdminClient()
    } catch (err: any) {
      console.error('[submissions] createAdminClient failed:', err)
      return apiError('Something went wrong. Please try again later.', 500)
    }

    const { data: registration, error: regError } = await admin
      .from('registrations')
      .select('id, status, team_id')
      .eq('hackathon_id', hackathonId)
      .eq('user_id', user.id)
      .single()

    if (regError || !registration) return apiError('You are not registered for this hackathon.', 404)
    if (!['team_created', 'submitted'].includes(registration.status)) {
      return apiError(`Cannot submit a project from status "${registration.status}".`, 400)
    }
    if (!registration.team_id) {
      return apiError('No team found for this registration.', 400)
    }

    const now = new Date().toISOString()
    const { data: submission, error: submissionError } = await admin
      .from('submissions')
      .upsert(
        {
          team_id: registration.team_id,
          hackathon_id: hackathonId,
          project_title: projectTitle,
          problem_statement: body.problem_statement || null,
          solution: body.solution || null,
          features: body.features || null,
          repo_link: body.repo_link || null,
          demo_video_url: body.demo_video_url || null,
          ppt_url: body.ppt_url || null,
          report_pdf_url: body.report_pdf_url || null,
          status: 'submitted',
          submitted_at: now,
        },
        { onConflict: 'team_id' }
      )
      .select()
      .single()

    if (submissionError) {
      console.error('[submissions] upsert failed:', submissionError)
      return apiError('Could not submit your project. Please try again.', 500)
    }

    if (registration.status !== 'submitted') {
      await admin.from('registrations').update({ status: 'submitted' }).eq('id', registration.id)
    }

    return apiSuccess({ submission, status: 'submitted' }, 'Project submitted successfully.')
  } catch (err: any) {
    console.error('[submissions] unhandled error:', err)
    return apiError('Something went wrong. Please try again.', 500)
  }
}
