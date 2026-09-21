import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createRazorpayClient } from '@/lib/razorpay'
import { getOrCreateOrder } from '@/lib/payments/orders'
import { apiSuccess, apiError } from '@/lib/apiResponse'

// registered/rejected -> payment_pending (if not already), then creates (or re-uses)
// a real Razorpay Order for the hackathon's registration_fee. The participant clicks
// "Pay Now" once and this does both steps. The order is recorded in `payment_orders`
// (kind = 'hackathon') BEFORE it is returned, which is what lets the webhook, the
// verify route and the sync route map a payment back to this registration.
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

    let order
    try {
      order = await getOrCreateOrder(admin, razorpay, {
        kind: 'hackathon',
        targetId: registration.id,
        amountRupees: Number(hackathon.registration_fee),
        currency: 'INR',
        notes: { student_id: user.id, hackathon_id: registration.hackathon_id },
      })
    } catch (err: any) {
      console.error('[create-order] order creation failed:', err)
      return apiError('Could not start payment. Please try again.', 500)
    }

    return apiSuccess(order, 'Order created.')
  } catch (err: any) {
    console.error('[create-order] unhandled error:', err)
    return apiError('Something went wrong. Please try again.', 500)
  }
}
