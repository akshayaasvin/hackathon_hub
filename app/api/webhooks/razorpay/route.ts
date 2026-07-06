import crypto from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { apiSuccess, apiError } from '@/lib/apiResponse'

// Razorpay webhook: payment_pending -> payment_submitted, automatically.
//
// Requires two things configured in your Razorpay dashboard for this to ever
// fire (neither of which can be set up from here — they're on your Razorpay
// account):
//   1. A webhook pointing at https://<your-domain>/api/webhooks/razorpay,
//      subscribed to at least the "payment_link.paid" event.
//   2. RAZORPAY_WEBHOOK_SECRET env var set to the signing secret Razorpay
//      shows you when you create that webhook.
// It also requires the registration id to travel with the payment so this
// route can find the row again — configure the Razorpay Payment Button's
// "Reference ID" field (or a custom `notes.registration_id`) to be set to
// the registration's id when the participant lands on the button.
//
// Until both are wired up, use the "Mark Payment Complete" self-report flow
// (app/api/registrations/[id]/confirm-payment) — that's the fully working,
// testable path today.
export async function POST(request: Request) {
  try {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET
    if (!secret) {
      console.warn('[razorpay webhook] RAZORPAY_WEBHOOK_SECRET not set — rejecting webhook call.')
      return apiError('Webhook not configured.', 501)
    }

    const rawBody = await request.text()
    const signature = request.headers.get('x-razorpay-signature')
    if (!signature) return apiError('Missing signature.', 400)

    const expectedSignature = crypto.createHmac('sha256', secret).update(rawBody).digest('hex')
    const validSignature =
      signature.length === expectedSignature.length &&
      crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))

    if (!validSignature) {
      console.error('[razorpay webhook] signature mismatch')
      return apiError('Invalid signature.', 401)
    }

    const payload = JSON.parse(rawBody)
    const event = payload?.event
    const paymentEntity = payload?.payload?.payment?.entity
    const registrationId: string | undefined =
      paymentEntity?.notes?.registration_id || payload?.payload?.payment_link?.entity?.reference_id

    if (!registrationId) {
      console.warn('[razorpay webhook] no registration_id in payload, event:', event)
      return apiSuccess({ ignored: true }, 'No registration reference in payload.')
    }

    const isPaidEvent = event === 'payment_link.paid' || event === 'payment.captured'
    if (!isPaidEvent) {
      return apiSuccess({ ignored: true }, `Ignoring event "${event}".`)
    }

    const admin = createAdminClient()
    const { data: registration } = await admin
      .from('registrations')
      .select('id, status')
      .eq('id', registrationId)
      .single()

    if (!registration) {
      console.warn('[razorpay webhook] registration not found:', registrationId)
      return apiSuccess({ ignored: true }, 'Registration not found.')
    }
    if (registration.status !== 'payment_pending') {
      return apiSuccess({ ignored: true }, `Registration already "${registration.status}".`)
    }

    await admin
      .from('registrations')
      .update({
        status: 'payment_submitted',
        payment_amount: paymentEntity?.amount ? paymentEntity.amount / 100 : null,
        payment_reference: paymentEntity?.id || null,
      })
      .eq('id', registrationId)

    return apiSuccess({ status: 'payment_submitted' }, 'Payment recorded.')
  } catch (err: any) {
    console.error('[razorpay webhook] unhandled error:', err)
    return apiError('Webhook processing failed.', 500)
  }
}
