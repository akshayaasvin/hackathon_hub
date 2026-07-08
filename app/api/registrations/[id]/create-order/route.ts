import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createRazorpayClient } from '@/lib/razorpay'
import { apiSuccess, apiError } from '@/lib/apiResponse'

// registered/rejected -> payment_pending (if not already), then creates a
// real Razorpay Order for the hackathon's registration_fee. Replaces the old
// hosted Payment Button + /pay route — the participant clicks "Pay Now" once
// and this does both steps, notes carry student_id/hackathon_id/registration_id
// so the webhook can find its way back to this row.
export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return apiError('Not authenticated.', 401)

    let admin
    try {
      admin = createAdminClient()
    } catch (err: any) {
      console.error('[create-order] createAdminClient failed:', err)
      return apiError('Something went wrong. Please try again later.', 500)
    }

    const { data: registration, error: fetchError } = await admin
      .from('registrations')
      .select('id, user_id, hackathon_id, status')
      .eq('id', params.id)
      .single()

    if (fetchError || !registration) return apiError('Registration not found.', 404)
    if (registration.user_id !== user.id) return apiError('Forbidden.', 403)
    if (!['registered', 'rejected', 'payment_pending'].includes(registration.status)) {
      return apiError(`Cannot start payment from status "${registration.status}".`, 400)
    }

    const { data: hackathon, error: hackathonError } = await admin
      .from('hackathons')
      .select('id, registration_fee')
      .eq('id', registration.hackathon_id)
      .single()

    if (hackathonError || !hackathon) return apiError('Hackathon not found.', 404)
    if (!hackathon.registration_fee || hackathon.registration_fee <= 0) {
      return apiError('Registration fee is not configured for this hackathon yet. Please contact the organizers.', 400)
    }

    let razorpay
    try {
      razorpay = createRazorpayClient()
    } catch (err: any) {
      console.error('[create-order] createRazorpayClient failed:', err)
      return apiError('Payments are not configured yet. Please contact the organizers.', 501)
    }

    if (registration.status !== 'payment_pending') {
      const { error: updateError } = await admin
        .from('registrations')
        .update({ status: 'payment_pending' })
        .eq('id', registration.id)
      if (updateError) {
        console.error('[create-order] status update failed:', updateError)
        return apiError('Could not start payment. Please try again.', 500)
      }
    }

    const amountPaise = Math.round(hackathon.registration_fee * 100)

    let order
    try {
      order = await razorpay.orders.create({
        amount: amountPaise,
        currency: 'INR',
        notes: {
          registration_id: registration.id,
          student_id: user.id,
          hackathon_id: registration.hackathon_id,
        },
      })
    } catch (err: any) {
      console.error('[create-order] razorpay order creation failed:', err)
      return apiError('Could not start payment. Please try again.', 500)
    }

    const { error: insertError } = await admin.from('payment_orders').insert({
      registration_id: registration.id,
      razorpay_order_id: order.id,
      amount: hackathon.registration_fee,
      currency: typeof order.currency === 'string' ? order.currency : 'INR',
      status: 'created',
    })
    if (insertError) {
      console.error('[create-order] payment_orders insert failed:', insertError)
    }

    return apiSuccess(
      { order_id: order.id, amount: amountPaise, currency: order.currency, key_id: process.env.RAZORPAY_KEY_ID },
      'Order created.'
    )
  } catch (err: any) {
    console.error('[create-order] unhandled error:', err)
    return apiError('Something went wrong. Please try again.', 500)
  }
}
