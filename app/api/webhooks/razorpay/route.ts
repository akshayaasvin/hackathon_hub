import { createAdminClient } from '@/lib/supabase/admin'
import { apiSuccess, apiError } from '@/lib/apiResponse'
import { verifyWebhookSignature } from '@/lib/razorpay'
import { settlePayment, markAttemptFailed, logPaymentEvent } from '@/lib/payments/settle'

// ONE Razorpay webhook for the whole app (Hackathon + Webinar):
//
//   https://hackathon.adz4needz.com/api/webhooks/razorpay
//   events: payment.captured, order.paid, payment.failed
//   secret: RAZORPAY_WEBHOOK_SECRET
//
// Why one endpoint and not one per product: Razorpay delivers every event of the
// ACCOUNT to every webhook URL, so two endpoints would just both receive both
// products' events and each ignore half. Classification does not need a second
// URL — settlePayment() looks the Razorpay order id up in our own `payment_orders`
// ledger, whose `kind` column says 'hackathon' or 'webinar'. That is a
// server-side identifier the browser can't forge (unlike payment notes).
//
// Reliability rules implemented here:
//   * signature is checked against the RAW body before anything is parsed;
//   * a redelivered event (same x-razorpay-event-id) that we already fully
//     processed is acknowledged without touching anything;
//   * the event is recorded only AFTER it was processed, so a crash mid-way
//     leaves it unrecorded and Razorpay's retry runs it again;
//   * events for orders that aren't ours (other sites on the same Razorpay
//     account) get 200 so Razorpay does not retry them for days;
//   * a DB failure returns 5xx so Razorpay DOES retry;
//   * payment.failed never changes a registration (see markAttemptFailed).
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

    if (!verifyWebhookSignature(rawBody, signature, secret)) {
      console.error('[razorpay webhook] signature mismatch')
      return apiError('Invalid signature.', 401)
    }

    let payload: any
    try {
      payload = JSON.parse(rawBody)
    } catch {
      return apiError('Invalid JSON.', 400)
    }

    const event: string | undefined = payload?.event
    const eventId = request.headers.get('x-razorpay-event-id')
    const payment = payload?.payload?.payment?.entity
    const orderId: string | undefined = payment?.order_id ?? undefined

    const admin = createAdminClient()

    if (eventId) {
      const { data: seen, error: seenError } = await admin
        .from('payment_events')
        .select('id')
        .eq('event_id', eventId)
        .maybeSingle()
      if (seenError) throw seenError
      if (seen) return apiSuccess({ duplicate: true }, 'Event already processed.')
    }

    let outcome: string

    if (event === 'payment.captured' || event === 'order.paid') {
      if (!payment?.id || !orderId) {
        outcome = 'ignored_no_payment'
      } else {
        outcome = (await settlePayment(admin, payment)).outcome
      }
    } else if (event === 'payment.failed') {
      if (orderId) await markAttemptFailed(admin, orderId)
      outcome = 'attempt_failed_recorded'
    } else {
      outcome = 'ignored_event'
    }

    await logPaymentEvent(admin, {
      event_id: eventId,
      source: 'webhook',
      event_type: event ?? null,
      razorpay_order_id: orderId ?? null,
      razorpay_payment_id: payment?.id ?? null,
      outcome,
    })

    return apiSuccess({ outcome }, 'OK')
  } catch (err: any) {
    // 5xx on purpose: Razorpay retries, and every step above is idempotent.
    console.error('[razorpay webhook] processing failed:', err)
    return apiError('Webhook processing failed.', 500)
  }
}

// Non-secret health check so you can confirm the deployment is configured:
//   GET https://hackathon.adz4needz.com/api/webhooks/razorpay
export async function GET() {
  return apiSuccess(
    {
      webhookSecretConfigured: !!process.env.RAZORPAY_WEBHOOK_SECRET,
      apiKeyConfigured: !!process.env.RAZORPAY_KEY_ID && !!process.env.RAZORPAY_KEY_SECRET,
    },
    'Razorpay webhook endpoint is live.'
  )
}
