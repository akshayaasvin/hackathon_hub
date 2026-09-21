import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createRazorpayClient } from '@/lib/razorpay'
import { syncRegistrationOrders } from '@/lib/payments/settle'
import { apiSuccess, apiError } from '@/lib/apiResponse'

// Self-heal for a Hackathon registration stuck in payment_pending: asks Razorpay
// what happened to this registration's order(s) and settles any captured payment.
// Covers "user paid, then closed the tab, and the webhook was late/lost/disabled".
// Called by the participant page on load and while waiting after checkout.
// Owner-only; idempotent; only ever moves a registration forward on real proof.
export async function POST(_request: Request, { params }: { params: { id: string } }) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return apiError('Not authenticated.', 401)

    const admin = createAdminClient()
    const { data: registration } = await admin
      .from('registrations')
      .select('id, user_id, status')
      .eq('id', params.id)
      .maybeSingle()
    if (!registration) return apiError('Registration not found.', 404)
    if (registration.user_id !== user.id) return apiError('Forbidden.', 403)

    if (['registered', 'payment_pending', 'rejected'].includes(registration.status)) {
      let razorpay
      try {
        razorpay = createRazorpayClient()
      } catch {
        return apiSuccess({ status: registration.status }, 'Payments are not configured.')
      }
      try {
        await syncRegistrationOrders(admin, razorpay, 'hackathon', registration.id)
      } catch (err) {
        console.error('[sync-payment] sync failed:', err)
        return apiError('Could not check the payment right now. Please retry.', 502)
      }
    }

    const { data: fresh } = await admin.from('registrations').select('status').eq('id', registration.id).maybeSingle()
    return apiSuccess({ status: fresh?.status ?? registration.status }, 'OK')
  } catch (err: any) {
    console.error('[sync-payment] unhandled error:', err)
    return apiError('Something went wrong. Please try again.', 500)
  }
}
