import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { apiSuccess, apiError } from '@/lib/apiResponse'

// payment_pending -> payment_submitted. Self-reported by the participant after
// completing the Razorpay payment (paste the payment/transaction reference).
// The real Razorpay webhook (app/api/webhooks/razorpay/route.ts) performs the
// same transition automatically when RAZORPAY_WEBHOOK_SECRET is configured;
// this route is the manual fallback so the flow works before that's wired up,
// and gives the admin something concrete (a reference string) to check against
// the Razorpay dashboard before approving.
export async function POST(request: Request, { params }: { params: { id: string } }) {
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
    const paymentReference = typeof body?.paymentReference === 'string' ? body.paymentReference.trim() : ''
    if (!paymentReference) {
      return apiError('Please paste your payment/transaction reference.', 400)
    }

    let admin
    try {
      admin = createAdminClient()
    } catch (err: any) {
      console.error('[confirm-payment] createAdminClient failed:', err)
      return apiError('Something went wrong. Please try again later.', 500)
    }

    const { data: registration, error: fetchError } = await admin
      .from('registrations')
      .select('id, user_id, status')
      .eq('id', params.id)
      .single()

    if (fetchError || !registration) return apiError('Registration not found.', 404)
    if (registration.user_id !== user.id) return apiError('Forbidden.', 403)
    if (registration.status !== 'payment_pending') {
      return apiError(`Cannot confirm payment from status "${registration.status}".`, 400)
    }

    const { error: updateError } = await admin
      .from('registrations')
      .update({ status: 'payment_submitted', payment_reference: paymentReference })
      .eq('id', params.id)

    if (updateError) {
      console.error('[confirm-payment] update failed:', updateError)
      return apiError('Could not submit payment confirmation. Please try again.', 500)
    }

    return apiSuccess({ status: 'payment_submitted' }, 'Payment submitted for review.')
  } catch (err: any) {
    console.error('[confirm-payment] unhandled error:', err)
    return apiError('Something went wrong. Please try again.', 500)
  }
}
