import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { apiSuccess, apiError } from '@/lib/apiResponse'

export const dynamic = 'force-dynamic'

// "My Internships" for the logged-in Student Portal (section 13/14). Login is required HERE
// (unlike every other /api/internship/** route) because this reads the participant's own
// private registration details. Matches by student_id (set at registration time when a
// session existed) OR by the account's own email (covers a student who applied BEFORE
// logging in, or from a different device without a session).
export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return apiError('Not authenticated.', 401)

    const admin = createAdminClient()
    const { data, error } = await admin
      .from('internship_registrations')
      .select(
        `id, registration_code, status, assessment_score, assessment_total, assessment_passed,
         amount, currency, payment_id, created_at,
         internship:internships(id, title, topic, duration_text, mode, start_date)`
      )
      .or(`student_id.eq.${user.id},email.eq.${(user.email || '').toLowerCase()}`)
      .order('created_at', { ascending: false })
    if (error) throw error

    return apiSuccess(
      {
        registrations: (data ?? []).map((r: any) => {
          const internship = Array.isArray(r.internship) ? r.internship[0] : r.internship
          return {
            registrationId: r.id,
            registrationCode: r.registration_code,
            status: r.status,
            assessmentScore: r.assessment_score,
            assessmentTotal: r.assessment_total,
            assessmentPassed: r.assessment_passed,
            paymentStatus: r.payment_id ? 'Paid' : r.amount != null ? 'Not required' : 'Pending',
            appliedAt: r.created_at,
            internship: internship ? { id: internship.id, title: internship.title, topic: internship.topic, duration: internship.duration_text, mode: internship.mode, startDate: internship.start_date } : null,
          }
        }),
      },
      'OK'
    )
  } catch (err) {
    console.error('[internship/mine] failed:', err)
    return apiError('Something went wrong. Please try again.', 500)
  }
}
