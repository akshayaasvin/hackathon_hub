'use client'

// Real Razorpay Orders API + Checkout.js flow — replaces the old hosted
// Payment Button embed. The order is created server-side (create-order
// route); this just opens Razorpay's modal against that order.

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

/**
 * Opens the Razorpay Checkout modal for an already-created order.
 * `onSuccess` fires with the client-side result the moment the user
 * completes payment — treat that as "verifying", not "paid": the source of
 * truth is the signature-verified webhook, which is what actually moves the
 * registration to 'approved'.
 */
export async function openRazorpayCheckout(
  order: RazorpayOrder,
  handlers: {
    name?: string
    email?: string
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
    description: 'Hackathon registration fee',
    prefill: { name: handlers.name, email: handlers.email },
    handler: (response: RazorpayCheckoutResult) => handlers.onSuccess(response),
    modal: { ondismiss: handlers.onDismiss },
  })

  rzp.on('payment.failed', (response: any) => {
    handlers.onFailure?.(response)
  })

  rzp.open()
}
