import { createAdminClient } from '@/lib/supabase/admin'
import { createRazorpayClient } from '@/lib/razorpay'
import { syncRegistrationOrders } from '@/lib/payments/settle'
import { apiSuccess, apiError } from '@/lib/apiResponse'

export const dynamic = 'force-dynamic'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Status of one internship registration, for the guest who created it (registrationId +
// access_token — same capability-token pattern as webinar). While unpaid, this also asks
// Razorpay what happened (self-heal), so the confirmation screen reaches the right answer
// even if the payment callback never fired and the webhook is late.
export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const token = new URL(request.url).searchParams.get('token') || ''
    if (!UUID_RE.test(params.id) || !UUID_RE.test(token)) return apiError('Registration not found.', 404)

    const admin = createAdminClient()
    const load = () =>
      admin
        .from('internship_registrations')
        .select(
          `id, registration_code, status, full_name, amount, payment_id, assessment_score, assessment_total, assessment_passed,
           internship:internships(title, is_paid, duration_text, start_date, mode)`
        )
        .eq('id', params.id)
        .eq('access_token', token)
        .maybeSingle()

    let { data, error } = await load()
    if (error) throw error
    if (!data) return apiError('Registration not found.', 404)

    if (data.status === 'payment_pending') {
      try {
        const razorpay = createRazorpayClient()
        if (await syncRegistrationOrders(admin, razorpay, 'internship', data.id)) {
          const reloaded = await load()
          if (reloaded.error) throw reloaded.error
          if (reloaded.data) data = reloaded.data
        }
      } catch (err) {
        console.error('[internship registration status] sync failed (non-fatal):', err)
      }
    }

    const internship: any = Array.isArray((data as any).internship) ? (data as any).internship[0] : (data as any).internship

    return apiSuccess(
      {
        status: data.status,
        registrationCode: data.registration_code,
        fullName: data.full_name,
        paymentStatus: data.payment_id ? 'Paid' : internship?.is_paid ? 'Pending' : 'Not required',
        assessmentScore: data.assessment_score,
        assessmentTotal: data.assessment_total,
        assessmentPassed: data.assessment_passed,
        internship: internship ? { title: internship.title, duration: internship.duration_text, startDate: internship.start_date, mode: internship.mode } : null,
      },
      'OK'
    )
  } catch (err) {
    console.error('[internship registration status] unhandled error:', err)
    return apiError('Something went wrong. Please try again.', 500)
  }
}
