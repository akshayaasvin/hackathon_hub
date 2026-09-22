import crypto from 'crypto'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { normalizeIndianMobile } from '@/lib/phone'
import { parseAssessmentQuestions, toPublicQuestion } from '@/lib/internshipAssessment'
import { apiSuccess, apiError } from '@/lib/apiResponse'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const bodySchema = z.object({
  fullName: z.string().trim().min(2, 'Full name is required').max(100),
  email: z.email('Enter a valid email address').max(254),
  phone: z.string().trim().min(7, 'Enter a valid mobile number').max(20),
})

// Starts the eligibility assessment (section 4/5) — public, no login. Creates (or resumes)
// the applicant's row at status='assessment_pending' and hands back the questions WITHOUT
// correct answers. assessment_started_at is set once and never moved on resume, so the
// time limit (enforced server-side in submit/route.ts) can't be reset by reopening the page.
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
    if (!parsed.success) return apiError(parsed.error.issues[0]?.message || 'Invalid input', 400)
    const phone = normalizeIndianMobile(parsed.data.phone)
    if (!phone) return apiError('Enter a valid 10-digit mobile number.', 400)
    const email = parsed.data.email.trim().toLowerCase()

    const admin = createAdminClient()
    const { data: internship, error: internshipError } = await admin
      .from('internships')
      .select('id, status, assessment_enabled, assessment_time_limit_minutes, assessment_questions')
      .eq('id', params.id)
      .maybeSingle()
    if (internshipError) throw internshipError
    if (!internship || internship.status !== 'published') return apiError('Internship not found.', 404)
    if (!internship.assessment_enabled) return apiError('This internship does not require an assessment.', 400)

    const questions = parseAssessmentQuestions(internship.assessment_questions)
    if (questions.length === 0) return apiError('The assessment for this internship is not ready yet. Please try again later.', 503)

    const { data: existing, error: existingError } = await admin
      .from('internship_registrations')
      .select('id, status, assessment_started_at')
      .eq('internship_id', internship.id)
      .eq('email', email)
      .maybeSingle()
    if (existingError) throw existingError

    if (existing && !['applied', 'assessment_pending', 'not_eligible'].includes(existing.status)) {
      return apiError('This email has already applied for this internship.', 409)
    }

    const accessToken = crypto.randomUUID()
    let registrationId: string
    let startedAt: string

    if (existing) {
      startedAt = existing.assessment_started_at || new Date().toISOString()
      const { error } = await admin
        .from('internship_registrations')
        .update({
          full_name: parsed.data.fullName,
          phone,
          status: 'assessment_pending',
          assessment_started_at: startedAt,
          access_token: accessToken,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
      if (error) throw error
      registrationId = existing.id
    } else {
      startedAt = new Date().toISOString()
      const { data: created, error: insertError } = await admin
        .from('internship_registrations')
        .insert({
          internship_id: internship.id,
          full_name: parsed.data.fullName,
          email,
          phone,
          status: 'assessment_pending',
          assessment_started_at: startedAt,
          access_token: accessToken,
        })
        .select('id')
        .single()
      if (insertError) {
        if ((insertError as any).code === '23505') return apiError('This email has already applied for this internship.', 409)
        throw insertError
      }
      registrationId = created.id
    }

    return apiSuccess(
      {
        registrationId,
        accessToken,
        startedAt,
        timeLimitMinutes: internship.assessment_time_limit_minutes,
        questions: questions.map(toPublicQuestion),
      },
      'Assessment started.'
    )
  } catch (err) {
    console.error('[internship assessment/start] failed:', err)
    return apiError('Something went wrong. Please try again.', 500)
  }
}
