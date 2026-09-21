import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import type Razorpay from 'razorpay'
import { getRazorpayKeyId } from '@/lib/razorpay'

export type PaymentKind = 'hackathon' | 'webinar'

export interface CheckoutOrder {
  order_id: string
  amount: number // paise
  currency: string
  key_id: string
}

// An unpaid order older than this is not reused; a fresh one is created instead.
const REUSE_WINDOW_MS = 24 * 60 * 60 * 1000

/**
 * The ONE place a Razorpay order is created, for both Hackathon and Webinar
 * payments. Guarantees that:
 *   - the amount comes from the caller (server-side DB fee), never the browser;
 *   - the order is written to `payment_orders` BEFORE it is handed to the
 *     browser (if that write fails we throw — a payment we cannot map back to a
 *     registration must never be started);
 *   - clicking "Pay" repeatedly re-uses the open order instead of creating a
 *     new one each time (one order = one possible charge).
 */
export async function getOrCreateOrder(
  admin: SupabaseClient,
  razorpay: Razorpay,
  opts: {
    kind: PaymentKind
    targetId: string
    amountRupees: number
    currency: string
    notes?: Record<string, string>
  }
): Promise<CheckoutOrder> {
  const { kind, targetId, amountRupees, currency } = opts
  const amountPaise = Math.round(amountRupees * 100)
  const targetColumn = kind === 'webinar' ? 'webinar_registration_id' : 'registration_id'

  const { data: open, error: openError } = await admin
    .from('payment_orders')
    .select('razorpay_order_id, amount, currency')
    .eq(targetColumn, targetId)
    .in('status', ['created', 'failed']) // 'failed' = an attempt failed; the order itself is still payable
    .gte('created_at', new Date(Date.now() - REUSE_WINDOW_MS).toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (openError) throw openError

  if (open && Math.round(Number(open.amount) * 100) === amountPaise && open.currency === currency) {
    return { order_id: open.razorpay_order_id, amount: amountPaise, currency, key_id: getRazorpayKeyId() }
  }

  const order = await razorpay.orders.create({
    amount: amountPaise,
    currency,
    // <=40 chars (Razorpay limit): 3-char prefix + 36-char uuid
    receipt: `${kind === 'webinar' ? 'wb' : 'hk'}_${targetId}`,
    notes: {
      ...opts.notes,
      type: kind === 'webinar' ? 'WEBINAR' : 'HACKATHON',
      [targetColumn]: targetId,
    },
  })

  const { error: insertError } = await admin.from('payment_orders').insert({
    kind,
    [targetColumn]: targetId,
    razorpay_order_id: order.id,
    amount: amountRupees,
    currency,
    status: 'created',
  })
  if (insertError) throw insertError

  return { order_id: order.id, amount: amountPaise, currency, key_id: getRazorpayKeyId() }
}
