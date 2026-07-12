import crypto from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { apiSuccess, apiError } from '@/lib/apiResponse'

// Razorpay webhook, source of truth for the real Orders API + Checkout.js
// flow (app/api/registrations/[id]/create-order):
//
//   payment.captured (signature verified) -> registrations.status = 'approved'
//     directly — a verified webhook is stronger proof of payment than the
//     old manual "paste your reference" self-report ever was, so this skips
//     the payment_submitted manual-review step entirely.
//   payment.failed -> registrations.status = 'rejected', same "Retry" UI
//     path the student already sees for an admin-rejected payment.
//   order.paid -> not applicable to the Orders API + Checkout.js flow (only
//     fires for Payment Links, which this app no longer uses); ignored.
//
// Requires two things configured in your Razorpay dashboard for this to
// ever fire (neither can be set up from here — they're on your Razorpay
// account):
//   1. A webhook pointing at https://<your-domain>/api/webhooks/razorpay,
//      subscribed to "payment.captured" and "payment.failed".
//   2. RAZORPAY_WEBHOOK_SECRET env var set to the signing secret Razorpay
//      shows you when you create that webhook.
//
// Every DB write below is checked and logged, and returns a 5xx on failure
// (not 2xx) specifically so Razorpay's webhook retry policy kicks in
// instead of the event being silently dropped — a registration that fails
// to update here must stay 'payment_pending', never look "handled".
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
    const orderId: string | undefined = paymentEntity?.order_id

    if (!registrationId) {
      console.warn('[razorpay webhook] no registration_id in payload, event:', event)
      return apiSuccess({ ignored: true }, 'No registration reference in payload.')
    }

    const admin = createAdminClient()

    if (event === 'payment.captured' || event === 'payment_link.paid') {
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

      const { error: approveError } = await admin
        .from('registrations')
        .update({
          status: 'approved',
          payment_method: 'razorpay',
          payment_amount: paymentEntity?.amount ? paymentEntity.amount / 100 : null,
          payment_reference: paymentEntity?.id || null,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', registrationId)

      if (approveError) {
        // Registration stays 'payment_pending' — return non-2xx so Razorpay
        // retries this webhook instead of treating it as delivered.
        console.error('[razorpay webhook] registrations approve update failed:', registrationId, approveError)
        return apiError('Failed to update registration.', 500)
      }

      if (orderId) {
        const { error: orderError } = await admin
          .from('payment_orders')
          .update({
            status: 'paid',
            razorpay_payment_id: paymentEntity?.id || null,
            updated_at: new Date().toISOString(),
          })
          .eq('razorpay_order_id', orderId)
        if (orderError) {
          // Registration is already approved (source of truth) — this is
          // only the audit trail, so log and continue rather than fail the
          // whole webhook and trigger a pointless retry.
          console.error('[razorpay webhook] payment_orders update failed:', orderId, orderError)
        }
      }

      return apiSuccess({ status: 'approved' }, 'Payment verified — registration approved.')
    }

    if (event === 'payment.failed') {
      const { error: rejectError } = await admin
        .from('registrations')
        .update({ status: 'rejected' })
        .eq('id', registrationId)
        .eq('status', 'payment_pending')

      if (rejectError) {
        console.error('[razorpay webhook] registrations reject update failed:', registrationId, rejectError)
        return apiError('Failed to update registration.', 500)
      }

      if (orderId) {
        const { error: orderError } = await admin
          .from('payment_orders')
          .update({ status: 'failed', updated_at: new Date().toISOString() })
          .eq('razorpay_order_id', orderId)
        if (orderError) {
          console.error('[razorpay webhook] payment_orders update failed:', orderId, orderError)
        }
      }

      return apiSuccess({ status: 'rejected' }, 'Payment failed — registration marked rejected.')
    }

    return apiSuccess({ ignored: true }, `Ignoring event "${event}".`)
  } catch (err: any) {
    console.error('[razorpay webhook] unhandled error:', err)
    return apiError('Webhook processing failed.', 500)
  }
}
