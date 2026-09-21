import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { createRazorpayClient, verifyCheckoutSignature } from '@/lib/razorpay'
import { settlePayment, logPaymentEvent } from '@/lib/payments/settle'
import { apiSuccess, apiError } from '@/lib/apiResponse'

// Server-side confirmation of a payment the BROWSER says succeeded. Used by both
// the Hackathon "Pay Now" flow and the Webinar flow.
//
// The browser's "success" is never trusted. This route:
//   1. checks Razorpay's Checkout signature (HMAC of order|payment with the key secret);
//   2. fetches the payment from Razorpay's API and requires status === 'captured',
//      the same order id, and the exact amount/currency we stored for that order;
//   3. only then settles the registration (idempotently — safe next to the webhook).
//
// No login is required: a valid signature + a captured payment on one of OUR
// orders is itself the proof, and the response carries no personal data.
const bodySchema = z.object({
  razorpay_order_id: z.string().min(5).max(64),
  razorpay_payment_id: z.string().min(5).max(64),
  razorpay_signature: z.string().min(10).max(256),
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
    if (!parsed.success) return apiError('Payment verification data is incomplete.', 400)
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = parsed.data

    if (!verifyCheckoutSignature(razorpay_order_id, razorpay_payment_id, razorpay_signature)) {
      return apiError('Payment signature verification failed.', 400)
    }

    let razorpay
    try {
      razorpay = createRazorpayClient()
    } catch (err) {
      console.error('[payments/verify] razorpay client:', err)
      return apiError('Payments are not configured yet.', 501)
    }

    let payment: any
    try {
      payment = await razorpay.payments.fetch(razorpay_payment_id)
    } catch (err) {
      console.error('[payments/verify] payments.fetch failed:', err)
      // Not a verdict on the payment — the client should keep polling / the webhook may still land.
      return apiError('Could not reach Razorpay to verify the payment. Please retry.', 502)
    }

    if (payment?.order_id !== razorpay_order_id) {
      return apiError('Payment does not belong to this order.', 400)
    }

    const admin = createAdminClient()
    const result = await settlePayment(admin, payment)

    await logPaymentEvent(admin, {
      source: 'verify',
      event_type: 'checkout.handler',
      razorpay_order_id,
      razorpay_payment_id,
      outcome: result.outcome,
    })

    switch (result.outcome) {
      case 'settled':
      case 'already_settled':
        return apiSuccess({ status: 'paid', kind: result.kind }, 'Payment verified.')
      case 'not_captured':
        // e.g. 'authorized' (auto-capture off) or 'failed'; caller keeps polling.
        return apiSuccess({ status: payment.status === 'failed' ? 'failed' : 'pending' }, 'Payment not captured yet.')
      case 'needs_review':
        return apiSuccess({ status: 'review' }, 'Payment received; our team will confirm it manually.')
      case 'amount_mismatch':
        return apiError('Payment amount does not match the order. Please contact the organizers.', 409)
      case 'unknown_order':
      default:
        return apiError('Unknown order.', 404)
    }
  } catch (err: any) {
    console.error('[payments/verify] unhandled error:', err)
    return apiError('Something went wrong. Please try again.', 500)
  }
}
