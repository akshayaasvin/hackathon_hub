import 'server-only'
import crypto from 'crypto'
import Razorpay from 'razorpay'

/**
 * Server-only Razorpay Orders API client. Only import from API routes —
 * needs RAZORPAY_KEY_SECRET, never expose that to the browser.
 *
 * One key pair serves every product (Hackathon + Webinar): Razorpay API keys
 * belong to the account, not to a website or a webhook.
 */
export function createRazorpayClient(): Razorpay {
  const key_id = process.env.RAZORPAY_KEY_ID
  const key_secret = process.env.RAZORPAY_KEY_SECRET
  if (!key_id || !key_secret) {
    throw new Error('Missing RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET.')
  }
  return new Razorpay({ key_id, key_secret })
}

/** The public key id handed to Checkout.js (safe to expose; it is not the secret). */
export function getRazorpayKeyId(): string {
  const key_id = process.env.RAZORPAY_KEY_ID
  if (!key_id) throw new Error('Missing RAZORPAY_KEY_ID.')
  return key_id
}

function hmacHex(secret: string, message: string): string {
  return crypto.createHmac('sha256', secret).update(message).digest('hex')
}

function safeEqualHex(a: string, b: string): boolean {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  return bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB)
}

/**
 * Verifies the signature Checkout.js returns to the browser after a payment:
 * HMAC_SHA256(order_id + "|" + payment_id, RAZORPAY_KEY_SECRET).
 * Proves the (order, payment) pair was produced by Razorpay for THIS account.
 */
export function verifyCheckoutSignature(orderId: string, paymentId: string, signature: string): boolean {
  const secret = process.env.RAZORPAY_KEY_SECRET
  if (!secret || !orderId || !paymentId || !signature) return false
  return safeEqualHex(hmacHex(secret, `${orderId}|${paymentId}`), signature)
}

/**
 * Verifies a webhook delivery: HMAC_SHA256(raw request body, webhook secret),
 * compared with the `x-razorpay-signature` header. Must be given the RAW body
 * text, not re-serialised JSON.
 */
export function verifyWebhookSignature(rawBody: string, signature: string, webhookSecret: string): boolean {
  if (!webhookSecret || !signature) return false
  return safeEqualHex(hmacHex(webhookSecret, rawBody), signature)
}
