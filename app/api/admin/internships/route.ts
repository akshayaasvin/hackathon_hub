import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/requireAdmin'
import { draftsToQuestions } from '@/lib/internshipForm'
import { draftsToAssessmentQuestions } from '@/lib/internshipAssessment'
import { apiSuccess, apiError } from '@/lib/apiResponse'

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
  topic: z.string().trim().max(200).optional().or(z.literal('')),
  description: z.string().trim().max(5000).optional().or(z.literal('')),
  category: z.string().trim().max(100).optional().or(z.literal('')),
  skillsRequired: z.array(z.string().trim().max(50)).max(30).optional(),
  eligibilityText: z.string().trim().max(2000).optional().or(z.literal('')),
  durationText: z.string().trim().max(100).optional().or(z.literal('')),
  mode: z.enum(['online', 'offline', 'hybrid']),
  startDate: z.string().trim().max(20).optional().or(z.literal('')),
  endDate: z.string().trim().max(20).optional().or(z.literal('')),
  applicationDeadline: z.string().trim().max(20).optional().or(z.literal('')),
  seatsTotal: z.coerce.number().int().positive().optional(),
  isPaid: z.boolean(),
  fee: z.coerce.number().min(0).max(10_000_000),
  assessmentEnabled: z.boolean(),
  assessmentPassingScorePercent: z.coerce.number().int().min(0).max(100),
  assessmentTimeLimitMinutes: z.coerce.number().int().positive().optional(),
  assessmentDrafts: z.array(z.any()).max(50),
  fixedFields: z.array(z.object({ key: z.string(), required: z.boolean() })).max(20),
  questionDrafts: z.array(z.any()).max(25),
  bannerUrl: z.string().trim().max(2000).optional().or(z.literal('')),
  emailSubject: z.string().trim().max(300).optional().or(z.literal('')),
  emailHeading: z.string().trim().max(300).optional().or(z.literal('')),
  emailBody: z.string().trim().max(5000).optional().or(z.literal('')),
  emailCtaText: z.string().trim().max(100).optional().or(z.literal('')),
  emailCtaLink: z.string().trim().max(500).optional().or(z.literal('')),
  emailInstructions: z.string().trim().max(3000).optional().or(z.literal('')),
  emailSupportContact: z.string().trim().max(200).optional().or(z.literal('')),
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
    if (!parsed.success) return apiError(parsed.error.issues[0]?.message || 'Invalid input', 400)

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
