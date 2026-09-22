import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { parseAssessmentQuestions, scoreAssessment } from '@/lib/internshipAssessment'
import { apiSuccess, apiError } from '@/lib/apiResponse'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const bodySchema = z.object({
  registrationId: z.string().uuid(),
  accessToken: z.string().uuid(),
  answers: z.record(z.string(), z.unknown()).optional(),
})

// Scores the assessment SERVER-SIDE against the stored correct answers — the browser never
// sees a correct answer, so it cannot influence the score. Enforces the time limit (if any)
// against assessment_started_at, set once in start/route.ts and never movable by the client.
export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    if (!UUID_RE.test(params.id)) return apiError('Internship not found.', 404)
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return apiError('Invalid request body — expected JSON.', 400)
    }
    const parsed = bodySchema.safeParse(body)
    if (!parsed.success) return apiError('Invalid submission.', 400)

    const admin = createAdminClient()
    const { data: internship, error: internshipError } = await admin
      .from('internships')
      .select('id, assessment_enabled, assessment_passing_score_percent, assessment_time_limit_minutes, assessment_questions')
      .eq('id', params.id)
      .maybeSingle()
    if (internshipError) throw internshipError
    if (!internship || !internship.assessment_enabled) return apiError('Internship not found.', 404)

    const { data: registration, error: regError } = await admin
      .from('internship_registrations')
      .select('id, status, assessment_started_at')
      .eq('id', parsed.data.registrationId)
      .eq('internship_id', internship.id)
      .eq('access_token', parsed.data.accessToken)
      .maybeSingle()
    if (regError) throw regError
    if (!registration) return apiError('Assessment session not found. Please start again.', 404)
    if (registration.status !== 'assessment_pending') {
      return apiError('This assessment has already been submitted.', 409)
    }

    if (internship.assessment_time_limit_minutes && registration.assessment_started_at) {
      const deadline = new Date(registration.assessment_started_at).getTime() + internship.assessment_time_limit_minutes * 60_000
      if (Date.now() > deadline) return apiError('The time limit for this assessment has passed. Please start again.', 400)
    }

    const questions = parseAssessmentQuestions(internship.assessment_questions)
    const scored = scoreAssessment(questions, internship.assessment_passing_score_percent, parsed.data.answers)
    if (scored.ok === false) return apiError(scored.message, 400)

    const { score, total, passed } = scored.result
    const now = new Date().toISOString()
    const { error: updateError } = await admin
      .from('internship_registrations')
      .update({
        status: passed ? 'eligible' : 'not_eligible',
        assessment_score: score,
        assessment_total: total,
        assessment_passed: passed,
        assessment_submitted_at: now,
        updated_at: now,
      })
      .eq('id', registration.id)
      .eq('status', 'assessment_pending') // guarded: a second concurrent submit is a no-op here
    if (updateError) throw updateError

    return apiSuccess(
      { passed, score, total, passingScorePercent: internship.assessment_passing_score_percent },
      passed ? 'You are eligible for this internship.' : 'You did not meet the eligibility criteria this time.'
    )
  } catch (err) {
    console.error('[internship assessment/submit] failed:', err)
    return apiError('Something went wrong. Please try again.', 500)
  }
}
