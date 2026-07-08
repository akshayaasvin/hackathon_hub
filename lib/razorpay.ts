import 'server-only'
import Razorpay from 'razorpay'

/**
 * Server-only Razorpay Orders API client. Only import from API routes —
 * needs RAZORPAY_KEY_SECRET, never expose that to the browser.
 */
export function createRazorpayClient(): Razorpay {
  const key_id = process.env.RAZORPAY_KEY_ID
  const key_secret = process.env.RAZORPAY_KEY_SECRET
  if (!key_id || !key_secret) {
    throw new Error('Missing RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET.')
  }
  return new Razorpay({ key_id, key_secret })
}
