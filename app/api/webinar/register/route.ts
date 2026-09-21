import crypto from 'crypto'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { createRazorpayClient } from '@/lib/razorpay'
import { getOrCreateOrder } from '@/lib/payments/orders'
import { sendWebinarConfirmation } from '@/lib/payments/settle'
import { apiSuccess, apiError } from '@/lib/apiResponse'

// Public (no login) webinar registration + payment start.
//
// The price is read from the `webinars` row here on the server; nothing about the
// amount comes from the request. The response tells the browser whether to open
// Razorpay (paid webinar), or that the registration is already complete (free).
//
// Re-submitting the same email for the same webinar is safe (unique index on
// (webinar_id, lower(email))): a paid one is reported as already registered, an
// unpaid one resumes payment on the SAME open Razorpay order.

const bodySchema = z.object({
  webinarId: z.string().uuid('Invalid webinar.'),
  fullName: z.string().trim().min(2, 'Full name is required').max(100),
  email: z.email('Enter a valid email address').max(254),
  phone: z.string().trim().min(7, 'Enter a valid mobile number').max(20),
})

// Accepts 10 digits, optionally prefixed with +91 / 91 / 0.
function normalizeIndianMobile(input: string): string | null {
  let digits = input.replace(/\D/g, '')
  if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2)
  else if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1)
  return /^[6-9]\d{9}$/.test(digits) ? digits : null
}

export async function POST(request: Request) {
  try {
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return apiError('Invalid request body — expected JSON.', 400)
    }
    const parsed = bodySchema.safeParse(body)
    if (!parsed.success) return apiError(parsed.error.issues[0]?.message || 'Invalid input', 400)

    const phone = normalizeIndianMobile(parsed.data.phone)
    if (!phone) return apiError('Enter a valid 10-digit mobile number.', 400)

    const email = parsed.data.email.trim().toLowerCase()
    const fullName = parsed.data.fullName
    const admin = createAdminClient()

    const { data: webinar, error: webinarError } = await admin
      .from('webinars')
      .select('id, title, fee, currency, status')
      .eq('id', parsed.data.webinarId)
      .maybeSingle()
    if (webinarError) throw webinarError
    if (!webinar) return apiError('Webinar not found.', 404)
    if (webinar.status !== 'published') return apiError('Registration for this webinar is closed.', 400)

    const fee = Number(webinar.fee)
    const currency = String(webinar.currency || 'INR')

    // Find or create the registration (one per webinar + email).
    const findExisting = () =>
      admin
        .from('webinar_registrations')
        .select('id, status')
        .eq('webinar_id', webinar.id)
        .eq('email', email) // always stored lower-cased, so an exact match is a case-insensitive match
        .maybeSingle()

    let { data: existing, error: existingError } = await findExisting()
    if (existingError) throw existingError

    if (existing && existing.status !== 'payment_pending') {
      return apiError('This email is already registered for this webinar.', 409)
    }

    const accessToken = crypto.randomUUID() // rotated on every (re)submit; see migration comment
    let registrationId: string

    if (existing) {
      const { error } = await admin
        .from('webinar_registrations')
        .update({ full_name: fullName, phone, access_token: accessToken, updated_at: new Date().toISOString() })
        .eq('id', existing.id)
        .eq('status', 'payment_pending')
      if (error) throw error
      registrationId = existing.id
    } else {
      const { data: created, error: insertError } = await admin
        .from('webinar_registrations')
        .insert({
          webinar_id: webinar.id,
          full_name: fullName,
          email,
          phone,
          status: fee > 0 ? 'payment_pending' : 'free',
          amount: fee > 0 ? null : 0,
          currency,
          access_token: accessToken,
        })
        .select('id')
        .single()

      if (insertError) {
        // 23505 = lost a race with a concurrent identical submit: treat as the existing row.
        if ((insertError as any).code === '23505') {
          const retry = await findExisting()
          if (retry.error) throw retry.error
          if (!retry.data) throw insertError
          if (retry.data.status !== 'payment_pending') return apiError('This email is already registered for this webinar.', 409)
          existing = retry.data
          registrationId = retry.data.id
          const { error } = await admin
            .from('webinar_registrations')
            .update({ access_token: accessToken, updated_at: new Date().toISOString() })
            .eq('id', registrationId)
          if (error) throw error
        } else {
          throw insertError
        }
      } else {
        registrationId = created.id
        if (fee <= 0) {
          await sendWebinarConfirmation(admin, registrationId).catch((err) =>
            console.error('[webinar/register] free confirmation email failed (non-fatal):', err)
          )
          return apiSuccess(
            { registrationId, accessToken, paymentRequired: false },
            'You are registered for this webinar.'
          )
        }
      }
    }

    if (fee <= 0) {
      // (existing pending row on a webinar whose fee was later set to 0)
      const { error } = await admin
        .from('webinar_registrations')
        .update({ status: 'free', amount: 0, updated_at: new Date().toISOString() })
        .eq('id', registrationId)
        .eq('status', 'payment_pending')
      if (error) throw error
      return apiSuccess({ registrationId, accessToken, paymentRequired: false }, 'You are registered for this webinar.')
    }

    let razorpay
    try {
      razorpay = createRazorpayClient()
    } catch (err) {
      console.error('[webinar/register] razorpay client:', err)
      return apiError('Payments are not configured yet. Please contact the organizers.', 501)
    }

    let order
    try {
      order = await getOrCreateOrder(admin, razorpay, {
        kind: 'webinar',
        targetId: registrationId,
        amountRupees: fee,
        currency,
        notes: { webinar_id: webinar.id },
      })
    } catch (err) {
      console.error('[webinar/register] order creation failed:', err)
      return apiError('Could not start payment. Please try again.', 500)
    }

    return apiSuccess({ registrationId, accessToken, paymentRequired: true, order }, 'Order created.')
  } catch (err: any) {
    console.error('[webinar/register] unhandled error:', err)
    return apiError('Something went wrong. Please try again.', 500)
  }
}
