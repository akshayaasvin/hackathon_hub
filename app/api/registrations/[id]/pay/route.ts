import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { apiSuccess, apiError } from '@/lib/apiResponse'

// registered -> payment_pending. Participant clicked "Pay Now" — this just
// opens the gate so the Razorpay button/webhook flow can proceed; it doesn't
// touch payment_amount/reference itself.
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
      console.error('[registrations/pay] createAdminClient failed:', err)
      return apiError('Something went wrong. Please try again later.', 500)
    }

    const { data: registration, error: fetchError } = await admin
      .from('registrations')
      .select('id, user_id, status')
      .eq('id', params.id)
      .single()

    if (fetchError || !registration) return apiError('Registration not found.', 404)
    if (registration.user_id !== user.id) return apiError('Forbidden.', 403)
    if (registration.status !== 'registered' && registration.status !== 'rejected') {
      return apiError(`Cannot start payment from status "${registration.status}".`, 400)
    }

    const { error: updateError } = await admin
      .from('registrations')
      .update({ status: 'payment_pending' })
      .eq('id', params.id)

    if (updateError) {
      console.error('[registrations/pay] update failed:', updateError)
      return apiError('Could not start payment. Please try again.', 500)
    }

    return apiSuccess({ status: 'payment_pending' }, 'Payment started.')
  } catch (err: any) {
    console.error('[registrations/pay] unhandled error:', err)
    return apiError('Something went wrong. Please try again.', 500)
  }
}
