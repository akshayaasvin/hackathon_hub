'use client'

// Real Razorpay Orders API + Checkout.js flow — replaces the old hosted
// Payment Button embed. The order is created server-side (create-order
// route); this just opens Razorpay's modal against that order.

import { postJson } from '@/lib/apiFetch'

declare global {
  interface Window {
    Razorpay: any
  }
}

let scriptPromise: Promise<void> | null = null

function loadCheckoutScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve()
  if (window.Razorpay) return Promise.resolve()
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script')
      script.src = 'https://checkout.razorpay.com/v1/checkout.js'
      script.async = true
      script.onload = () => resolve()
      script.onerror = () => reject(new Error('Failed to load the Razorpay checkout script.'))
      document.body.appendChild(script)
    })
  }
  return scriptPromise
}

export interface RazorpayOrder {
  order_id: string
  amount: number
  currency: string
  key_id: string
}

export interface RazorpayCheckoutResult {
  razorpay_payment_id: string
  razorpay_order_id: string
  razorpay_signature: string
}

export type VerifyOutcome = 'paid' | 'pending' | 'failed' | 'review' | 'error'

/**
 * Asks OUR server to confirm a payment the browser reports as successful.
 * The server checks Razorpay's signature, re-fetches the payment from Razorpay's
 * API and settles the registration (see app/api/payments/verify). Retries a few
 * times on network / Razorpay-side hiccups. 'pending' means "not captured yet" —
 * keep polling; the webhook and the status/sync routes will also catch up.
 */
export async function verifyPaymentOnServer(result: RazorpayCheckoutResult): Promise<VerifyOutcome> {
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await new Promise((resolve) => setTimeout(resolve, 1500 * attempt))
    const res = await postJson<{ status: 'paid' | 'pending' | 'failed' | 'review' }>('/api/payments/verify', result)
    if (res.success && res.data?.status) return res.data.status
    // A definite "no" (bad signature / unknown order / amount mismatch) is not worth retrying.
    if (!res.success && /signature|Unknown order|amount does not match|belong/i.test(res.message)) return 'error'
  }
  return 'error'
}

/**
 * Opens the Razorpay Checkout modal for an already-created order.
 * `onSuccess` fires with the client-side result the moment the user
 * completes payment — treat that as "verifying", not "paid": call
 * verifyPaymentOnServer() next. The registration only changes once the SERVER
 * has verified the payment (or the signature-verified webhook arrives first).
 */
export async function openRazorpayCheckout(
  order: RazorpayOrder,
  handlers: {
    name?: string
    email?: string
    contact?: string
    description?: string
    onSuccess: (result: RazorpayCheckoutResult) => void
    onDismiss: () => void
    onFailure?: (error: any) => void
  }
): Promise<void> {
  await loadCheckoutScript()

  const rzp = new window.Razorpay({
    key: order.key_id,
    order_id: order.order_id,
    amount: order.amount,
    currency: order.currency,
    name: 'HackathonHub',
    description: handlers.description ?? 'Hackathon registration fee',
    prefill: { name: handlers.name, email: handlers.email, contact: handlers.contact },
    handler: (response: RazorpayCheckoutResult) => handlers.onSuccess(response),
    modal: { ondismiss: handlers.onDismiss },
  })

  rzp.on('payment.failed', (response: any) => {
    handlers.onFailure?.(response)
  })

  rzp.open()
}
