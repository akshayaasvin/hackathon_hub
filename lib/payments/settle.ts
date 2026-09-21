import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import type Razorpay from 'razorpay'
import { sendEmail, webinarConfirmationEmailHtml } from '@/lib/email'
import type { PaymentKind } from './orders'

/**
 * Single settlement path for EVERY Razorpay payment (Hackathon + Webinar).
 *
 * Three entry points feed it, all converging on `settlePayment`:
 *   1. the signature-verified webhook          (async, Razorpay -> us)
 *   2. POST /api/payments/verify               (browser callback, re-checked against Razorpay's API)
 *   3. syncOrder()                             (self-heal: asks Razorpay what happened to an order)
 *
 * Idempotency: registrations only ever move forward through GUARDED updates
 * ("... where status in (<unpaid states>)"). Postgres makes that atomic, so when a
 * webhook, a verify call and a retry race each other exactly one of them performs
 * the transition and the rest observe `already_settled`. A payment_id can only
 * belong to one registration (unique index) and one paid order (partial unique index).
 */

export interface RazorpayPaymentLike {
  id: string
  order_id?: string | null
  status: string
  amount: number // paise
  currency: string
}

export type SettleOutcome =
  | 'settled' // this call moved the registration to paid/approved
  | 'already_settled' // replay of a payment we already recorded — success, no change
  | 'not_captured' // payment exists but is not captured (yet / failed)
  | 'unknown_order' // order id is not in payment_orders: not ours (same Razorpay account, other site)
  | 'amount_mismatch' // captured amount/currency differs from what we ordered — NEVER auto-approve
  | 'needs_review' // money was captured but the registration is in a state we will not overwrite

export interface SettleResult {
  outcome: SettleOutcome
  kind?: PaymentKind
  targetId?: string
}

export async function settlePayment(admin: SupabaseClient, payment: RazorpayPaymentLike): Promise<SettleResult> {
  if (!payment?.id || !payment.order_id) return { outcome: 'unknown_order' }

  // The server-side identifier: our own ledger row for this Razorpay order.
  const { data: order, error: orderError } = await admin
    .from('payment_orders')
    .select('id, kind, registration_id, webinar_registration_id, amount, currency')
    .eq('razorpay_order_id', payment.order_id)
    .maybeSingle()
  if (orderError) throw orderError
  if (!order) return { outcome: 'unknown_order' }

  const kind = order.kind as PaymentKind
  const targetId = (kind === 'webinar' ? order.webinar_registration_id : order.registration_id) as string
  const base = { kind, targetId }

  if (payment.status !== 'captured') return { outcome: 'not_captured', ...base }

  const expectedPaise = Math.round(Number(order.amount) * 100)
  if (
    Number(payment.amount) !== expectedPaise ||
    String(payment.currency).toUpperCase() !== String(order.currency).toUpperCase()
  ) {
    console.error('[payments] amount/currency mismatch — NOT settling', {
      payment: payment.id,
      order: payment.order_id,
      expectedPaise,
      gotPaise: payment.amount,
      expectedCurrency: order.currency,
      gotCurrency: payment.currency,
    })
    return { outcome: 'amount_mismatch', ...base }
  }

  const now = new Date().toISOString()
  const amountRupees = Number(order.amount)

  const outcome =
    kind === 'webinar'
      ? await settleWebinar(admin, targetId, payment.id, amountRupees, String(order.currency), now)
      : await settleHackathon(admin, targetId, payment.id, amountRupees, now)

  if (outcome === 'needs_review') {
    console.error('[payments] captured payment could not be applied — manual review needed', {
      kind,
      targetId,
      payment: payment.id,
      order: payment.order_id,
    })
    return { outcome, ...base }
  }

  // Ledger row. Runs for 'already_settled' too so a retry heals a half-finished earlier attempt.
  const { error: ledgerError } = await admin
    .from('payment_orders')
    .update({ status: 'paid', razorpay_payment_id: payment.id, updated_at: now })
    .eq('id', order.id)
    .neq('status', 'paid')
  if (ledgerError) throw ledgerError

  if (outcome === 'settled' && kind === 'webinar') {
    // Only the call that actually performed the transition sends the email.
    await sendWebinarConfirmation(admin, targetId).catch((err) =>
      console.error('[payments] webinar confirmation email failed (non-fatal):', err)
    )
  }

  return { outcome, ...base }
}

async function settleHackathon(
  admin: SupabaseClient,
  registrationId: string,
  paymentId: string,
  amountRupees: number,
  now: string
): Promise<'settled' | 'already_settled' | 'needs_review'> {
  // 'rejected' and 'registered' are included on purpose: a captured payment is the
  // strongest proof there is, and the old flow could leave a paid registration in
  // 'rejected' (a failed first attempt followed by a successful retry).
  const { data: updated, error } = await admin
    .from('registrations')
    .update({
      status: 'approved',
      payment_method: 'razorpay',
      payment_amount: amountRupees,
      payment_reference: paymentId,
      reviewed_at: now,
    })
    .eq('id', registrationId)
    .in('status', ['registered', 'payment_pending', 'rejected'])
    .select('id')
  if (error) throw error
  if (updated && updated.length > 0) return 'settled'

  const { data: current, error: currentError } = await admin
    .from('registrations')
    .select('status, payment_reference')
    .eq('id', registrationId)
    .maybeSingle()
  if (currentError) throw currentError
  return current?.payment_reference === paymentId ? 'already_settled' : 'needs_review'
}

async function settleWebinar(
  admin: SupabaseClient,
  webinarRegistrationId: string,
  paymentId: string,
  amountRupees: number,
  currency: string,
  now: string
): Promise<'settled' | 'already_settled' | 'needs_review'> {
  const { data: updated, error } = await admin
    .from('webinar_registrations')
    .update({
      status: 'paid',
      amount: amountRupees,
      currency,
      payment_id: paymentId,
      paid_at: now,
      updated_at: now,
    })
    .eq('id', webinarRegistrationId)
    .eq('status', 'payment_pending')
    .select('id')
  if (error) throw error
  if (updated && updated.length > 0) return 'settled'

  const { data: current, error: currentError } = await admin
    .from('webinar_registrations')
    .select('status, payment_id')
    .eq('id', webinarRegistrationId)
    .maybeSingle()
  if (currentError) throw currentError
  return current?.payment_id === paymentId ? 'already_settled' : 'needs_review'
}

/** Emails the confirmation (with join link when set). Never throws to callers that .catch it. */
export async function sendWebinarConfirmation(admin: SupabaseClient, webinarRegistrationId: string) {
  const { data, error } = await admin
    .from('webinar_registrations')
    .select('full_name, email, amount, payment_id, webinar:webinars(title, starts_at, join_url)')
    .eq('id', webinarRegistrationId)
    .maybeSingle()
  if (error) throw error
  if (!data) return
  const webinar: any = Array.isArray((data as any).webinar) ? (data as any).webinar[0] : (data as any).webinar
  if (!webinar) return
  const result: any = await sendEmail({
    to: data.email,
    subject: `You're registered: ${webinar.title}`,
    html: webinarConfirmationEmailHtml({
      fullName: data.full_name,
      webinarTitle: webinar.title,
      startsAt: webinar.starts_at,
      joinUrl: webinar.join_url,
      paymentId: data.payment_id,
      amount: data.amount != null ? Number(data.amount) : null,
    }),
  })
  // sendEmail reports problems in its return value instead of throwing; surface them so the
  // callers' logs (and the admin "Resend" button) show WHY an email did not go out.
  if (result?.skipped) throw new Error('Email is not configured (RESEND_API_KEY is missing).')
  if (result?.error) throw new Error(result.error.message || 'The email provider rejected the message.')
}

/**
 * Self-heal: ask Razorpay what actually happened to an order and settle any
 * captured payment. Safe to call repeatedly (settlePayment is idempotent).
 * This is what makes the flow correct even if the browser closed before the
 * callback ran AND the webhook was late, lost or disabled.
 */
export async function syncOrder(
  admin: SupabaseClient,
  razorpay: Razorpay,
  razorpayOrderId: string
): Promise<SettleResult> {
  const list: any = await razorpay.orders.fetchPayments(razorpayOrderId)
  const items: any[] = list?.items ?? []
  const captured = items.find((p) => p.status === 'captured')
  if (!captured) return { outcome: 'not_captured' }
  return settlePayment(admin, captured)
}

/** Sync every payable order of one registration (newest first). Returns true if anything is paid. */
export async function syncRegistrationOrders(
  admin: SupabaseClient,
  razorpay: Razorpay,
  kind: PaymentKind,
  targetId: string
): Promise<boolean> {
  const column = kind === 'webinar' ? 'webinar_registration_id' : 'registration_id'
  const { data: orders, error } = await admin
    .from('payment_orders')
    .select('razorpay_order_id')
    .eq(column, targetId)
    .in('status', ['created', 'failed'])
    .order('created_at', { ascending: false })
    .limit(3)
  if (error) throw error
  for (const o of orders ?? []) {
    const result = await syncOrder(admin, razorpay, o.razorpay_order_id)
    await logPaymentEvent(admin, {
      source: 'sync',
      event_type: 'orders.fetchPayments',
      razorpay_order_id: o.razorpay_order_id,
      outcome: result.outcome,
    })
    if (result.outcome === 'settled' || result.outcome === 'already_settled') return true
  }
  return false
}

/**
 * A failed attempt is informational only. It must NEVER change a registration:
 * Razorpay lets the customer retry on the same order, and a later success has
 * to be able to win. (The previous webhook flipped the registration to
 * 'rejected' here, which then made a successful retry get ignored.)
 */
export async function markAttemptFailed(admin: SupabaseClient, razorpayOrderId: string) {
  const { error } = await admin
    .from('payment_orders')
    .update({ status: 'failed', updated_at: new Date().toISOString() })
    .eq('razorpay_order_id', razorpayOrderId)
    .eq('status', 'created')
  if (error) throw error
}

export async function logPaymentEvent(
  admin: SupabaseClient,
  event: {
    event_id?: string | null
    source: 'webhook' | 'verify' | 'sync'
    event_type?: string | null
    razorpay_order_id?: string | null
    razorpay_payment_id?: string | null
    outcome: string
  }
) {
  try {
    const { error } = await admin
      .from('payment_events')
      .upsert({ event_id: event.event_id ?? null, ...event }, { onConflict: 'event_id', ignoreDuplicates: true })
    if (error) console.error('[payments] payment_events log failed (non-fatal):', error)
  } catch (err) {
    console.error('[payments] payment_events log failed (non-fatal):', err)
  }
}
