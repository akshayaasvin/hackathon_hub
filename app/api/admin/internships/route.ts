import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/requireAdmin'
import { draftsToQuestions } from '@/lib/internshipForm'
import { draftsToAssessmentQuestions } from '@/lib/internshipAssessment'
import { apiSuccess, apiError } from '@/lib/apiResponse'
import { formatZodError } from '@/lib/zodError'
import { optionalText } from '@/lib/zodHelpers'

// Admin internship management (section 8/15). GET lists EVERY status (draft/published/
// closed/archived) — unlike the public list route, which only shows published. POST
// creates a new internship (always starts as 'draft'; publish is a separate PUT).
export async function GET() {
  try {
    if (!(await requireAdmin())) return apiError('Forbidden — admin access required.', 403)
    const admin = createAdminClient()
    const { data, error } = await admin.from('internships').select('*').order('created_at', { ascending: false })
    if (error) throw error
    return apiSuccess({ internships: data ?? [] }, 'OK')
  } catch (err) {
    console.error('[admin internships list] failed:', err)
    return apiError('Something went wrong. Please try again.', 500)
  }
}

const bodySchema = z.object({
  title: z.string().trim().min(2, 'Title is required').max(200),
  topic: optionalText(200),
  description: optionalText(5000),
  category: optionalText(100),
  skillsRequired: z.array(z.string().trim().max(50)).max(30).optional(),
  eligibilityText: optionalText(2000),
  durationText: optionalText(100),
  mode: z.enum(['online', 'offline', 'hybrid']),
  startDate: optionalText(20),
  endDate: optionalText(20),
  applicationDeadline: optionalText(20),
  seatsTotal: z.coerce.number().int().positive().optional(),
  isPaid: z.boolean(),
  fee: z.coerce.number().min(0).max(10_000_000),
  assessmentEnabled: z.boolean(),
  assessmentPassingScorePercent: z.coerce.number().int().min(0).max(100),
  assessmentTimeLimitMinutes: z.coerce.number().int().positive().optional(),
  assessmentDrafts: z.array(z.any()).max(50),
  fixedFields: z.array(z.object({ key: z.string(), required: z.boolean() })).max(20),
  questionDrafts: z.array(z.any()).max(25),
  bannerUrl: optionalText(2000),
  emailSubject: optionalText(300),
  emailHeading: optionalText(300),
  emailBody: optionalText(5000),
  emailCtaText: optionalText(100),
  emailCtaLink: optionalText(500),
  emailInstructions: optionalText(3000),
  emailSupportContact: optionalText(200),
  status: z.enum(['draft', 'published', 'closed', 'archived']).optional(),
})

export function buildInternshipPayload(input: z.infer<typeof bodySchema>) {
  const questions = draftsToQuestions(input.questionDrafts as any)
  if (questions.ok === false) return { ok: false as const, message: questions.message }
  const assessmentQuestions = draftsToAssessmentQuestions(input.assessmentDrafts as any)
  if (assessmentQuestions.ok === false) return { ok: false as const, message: assessmentQuestions.message }

  return {
    ok: true as const,
    payload: {
      title: input.title,
      topic: input.topic || null,
      description: input.description || null,
      category: input.category || null,
      skills_required: input.skillsRequired ?? [],
      eligibility_text: input.eligibilityText || null,
      duration_text: input.durationText || null,
      mode: input.mode,
      start_date: input.startDate || null,
      end_date: input.endDate || null,
      application_deadline: input.applicationDeadline || null,
      seats_total: input.seatsTotal ?? null,
      is_paid: input.isPaid,
      fee: input.isPaid ? input.fee : 0,
      assessment_enabled: input.assessmentEnabled,
      assessment_passing_score_percent: input.assessmentPassingScorePercent,
      assessment_time_limit_minutes: input.assessmentTimeLimitMinutes ?? null,
      assessment_questions: assessmentQuestions.questions,
      form_config: { fixedFields: input.fixedFields, questions: questions.questions },
      banner_url: input.bannerUrl || null,
      email_subject: input.emailSubject || null,
      email_heading: input.emailHeading || null,
      email_body: input.emailBody || null,
      email_cta_text: input.emailCtaText || null,
      email_cta_link: input.emailCtaLink || null,
      email_instructions: input.emailInstructions || null,
      email_support_contact: input.emailSupportContact || null,
      updated_at: new Date().toISOString(),
    },
  }
}

export async function POST(request: Request) {
  try {
    const adminUser = await requireAdmin()
    if (!adminUser) return apiError('Forbidden — admin access required.', 403)

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return apiError('Invalid request body — expected JSON.', 400)
    }
    const parsed = bodySchema.safeParse(body)
    if (!parsed.success) return apiError(formatZodError(parsed.error), 400)

    const built = buildInternshipPayload(parsed.data)
    if (built.ok === false) return apiError(built.message, 400)

    const admin = createAdminClient()
    const { data, error } = await admin
      .from('internships')
      .insert({ ...built.payload, status: 'draft', created_by: adminUser.id })
      .select('id')
      .single()
    if (error) throw error

    return apiSuccess({ id: data.id }, 'Internship created.')
  } catch (err) {
    console.error('[admin internships create] failed:', err)
    return apiError('Something went wrong. Please try again.', 500)
  }
}
