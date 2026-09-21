import { createAdminClient } from '@/lib/supabase/admin'
import { sendWebinarConfirmation } from '@/lib/payments/settle'
import { requireAdmin } from '@/lib/requireAdmin'
import { apiSuccess, apiError } from '@/lib/apiResponse'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Admin "Resend email": re-sends the confirmation (with the current join link) to a
// paid / free registrant. Reports the real reason if the email provider refuses it.
export async function POST(_request: Request, { params }: { params: { id: string } }) {
  try {
    if (!(await requireAdmin())) return apiError('Forbidden — admin access required.', 403)
    if (!UUID_RE.test(params.id)) return apiError('Registration not found.', 404)

    const admin = createAdminClient()
    const { data: registration, error } = await admin
      .from('webinar_registrations')
      .select('id, status, email')
      .eq('id', params.id)
      .maybeSingle()
    if (error) throw error
    if (!registration) return apiError('Registration not found.', 404)
    if (registration.status !== 'paid' && registration.status !== 'free') {
      return apiError('Only confirmed (paid or free) registrations can be emailed.', 400)
    }

    try {
      await sendWebinarConfirmation(admin, registration.id)
    } catch (err: any) {
      console.error('[webinar resend] email failed:', err)
      return apiError(`Email could not be sent: ${err?.message || 'unknown error'}`, 502)
    }
    return apiSuccess({}, `Confirmation email sent to ${registration.email}.`)
  } catch (err: any) {
    console.error('[webinar resend] unhandled error:', err)
    return apiError('Something went wrong. Please try again.', 500)
  }
}
