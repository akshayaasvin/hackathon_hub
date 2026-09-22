import { createAdminClient } from '@/lib/supabase/admin'
import { parseFormConfig, FIXED_FIELD_DEFS } from '@/lib/internshipForm'
import { parseAssessmentQuestions } from '@/lib/internshipAssessment'
import { apiSuccess, apiError } from '@/lib/apiResponse'

export const dynamic = 'force-dynamic'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Public internship details (section 3/4). Returns the registration FORM CONFIG (which
// fixed fields + custom questions to ask) and assessment META (question count, passing
// score, time limit) — but never the assessment questions themselves or any correct answer;
// those are only ever sent from assessment/start, one attempt at a time.
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    if (!UUID_RE.test(params.id)) return apiError('Internship not found.', 404)

    const admin = createAdminClient()
    const { data: internship, error } = await admin
      .from('internships')
      .select(
        `id, title, topic, description, category, skills_required, eligibility_text,
         duration_text, mode, start_date, end_date, application_deadline, seats_total,
         is_paid, fee, currency, assessment_enabled, assessment_passing_score_percent,
         assessment_time_limit_minutes, assessment_questions, form_config, banner_url, status, deleted_at`
      )
      .eq('id', params.id)
      .maybeSingle()
    if (error) throw error
    if (!internship || internship.status !== 'published' || internship.deleted_at) return apiError('Internship not found.', 404)

    const formConfig = parseFormConfig(internship.form_config)
    const fixedFields = formConfig.fixedFields.map((f) => {
      const def = FIXED_FIELD_DEFS.find((d) => d.key === f.key)!
      return { key: f.key, label: def.label, type: def.type, required: f.required, ...('options' in def ? { options: def.options } : {}) }
    })

    let seatsAvailable: number | null = null
    if (internship.seats_total != null) {
      const { count } = await admin
        .from('internship_registrations')
        .select('id', { count: 'exact', head: true })
        .eq('internship_id', internship.id)
        .in('status', ['eligible', 'payment_pending', 'registered', 'active', 'completed', 'certificate_issued'])
      seatsAvailable = Math.max(0, internship.seats_total - (count ?? 0))
    }

    return apiSuccess(
      {
        id: internship.id,
        title: internship.title,
        topic: internship.topic,
        description: internship.description,
        category: internship.category,
        skillsRequired: internship.skills_required,
        eligibilityText: internship.eligibility_text,
        durationText: internship.duration_text,
        mode: internship.mode,
        startDate: internship.start_date,
        endDate: internship.end_date,
        applicationDeadline: internship.application_deadline,
        seatsTotal: internship.seats_total,
        seatsAvailable,
        isPaid: internship.is_paid,
        fee: Number(internship.fee),
        currency: internship.currency,
        bannerUrl: internship.banner_url,
        assessment: internship.assessment_enabled
          ? {
              enabled: true,
              questionCount: parseAssessmentQuestions(internship.assessment_questions).length,
              passingScorePercent: internship.assessment_passing_score_percent,
              timeLimitMinutes: internship.assessment_time_limit_minutes,
            }
          : { enabled: false },
        formConfig: { fixedFields, questions: formConfig.questions },
      },
      'OK'
    )
  } catch (err) {
    console.error('[internship details] failed:', err)
    return apiError('Could not load this internship.', 500)
  }
}
