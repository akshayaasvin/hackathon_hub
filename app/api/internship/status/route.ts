import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { apiSuccess, apiError } from '@/lib/apiResponse'

// Public status lookup (section 11): /internship/status. Since applying needs no login,
// this is how an applicant checks progress — by Registration ID + the SAME email they
// applied with. Returns only public-safe status information, never phone/address/resume/
// form answers (section 18: "Do not expose private information publicly").
const bodySchema = z.object({
  email: z.email('Enter a valid email address').max(254),
  registrationCode: z.string().trim().min(5).max(30),
})

export async function POST(request: Request) {
  try {
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return apiError('Invalid request body — expected JSON.', 400)
    }
    const parsed = bodySchema.safeParse(body)
    if (!parsed.success) return apiError(parsed.error.issues[0]?.message || 'Invalid input', 400)
    const email = parsed.data.email.trim().toLowerCase()
    const code = parsed.data.registrationCode.trim().toUpperCase()

    const admin = createAdminClient()
    const { data, error } = await admin
      .from('internship_registrations')
      .select(
        `status, assessment_score, assessment_total, assessment_passed, amount, currency, payment_id, created_at,
         internship:internships(title, topic, duration_text, start_date, mode, eligibility_text)`
      )
      .eq('email', email)
      .eq('registration_code', code)
      .maybeSingle()
    if (error) throw error
    // Same message whether the code or the email was wrong — no hint about which.
    if (!data) return apiError('No registration found for that Registration ID and email.', 404)

    const internship: any = Array.isArray((data as any).internship) ? (data as any).internship[0] : (data as any).internship

    return apiSuccess(
      {
        status: data.status,
        internshipName: internship?.title ?? null,
        internshipTopic: internship?.topic ?? null,
        duration: internship?.duration_text ?? null,
        startDate: internship?.start_date ?? null,
        mode: internship?.mode ?? null,
        eligibilityText: internship?.eligibility_text ?? null,
        assessmentStatus: data.assessment_score != null ? (data.assessment_passed ? 'Eligible' : 'Not eligible') : 'Not required',
        assessmentScore: data.assessment_score,
        assessmentTotal: data.assessment_total,
        paymentStatus: data.payment_id ? 'Paid' : data.amount != null ? 'Not required' : 'Pending',
        appliedAt: data.created_at,
      },
      'OK'
    )
  } catch (err) {
    console.error('[internship status] failed:', err)
    return apiError('Something went wrong. Please try again.', 500)
  }
}
