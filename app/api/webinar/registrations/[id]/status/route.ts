import { createAdminClient } from '@/lib/supabase/admin'
import { createRazorpayClient } from '@/lib/razorpay'
import { syncRegistrationOrders } from '@/lib/payments/settle'
import { apiSuccess, apiError } from '@/lib/apiResponse'

export const dynamic = 'force-dynamic'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Status of one webinar registration, for the guest who created it.
// Access = registration id + the access_token returned by /api/webinar/register.
// While the registration is unpaid this also asks Razorpay what happened (self-heal),
// so the page reaches the right answer even if the webhook is late or never arrives.
// The join link is only ever included once the registration is paid / free.
export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const token = new URL(request.url).searchParams.get('token') || ''
    if (!UUID_RE.test(params.id) || !UUID_RE.test(token)) return apiError('Registration not found.', 404)

    const admin = createAdminClient()
    const load = () =>
      admin
        .from('webinar_registrations')
        .select('id, status, full_name, amount, payment_id, webinar:webinars(title, starts_at, join_url)')
        .eq('id', params.id)
        .eq('access_token', token)
        .maybeSingle()

    let { data, error } = await load()
    if (error) throw error
    if (!data) return apiError('Registration not found.', 404)

    if (data.status === 'payment_pending') {
      try {
        const razorpay = createRazorpayClient()
        if (await syncRegistrationOrders(admin, razorpay, 'webinar', data.id)) {
          const reloaded = await load()
          if (reloaded.error) throw reloaded.error
          if (reloaded.data) data = reloaded.data
        }
      } catch (err) {
        // Sync is best-effort here; the webhook / next poll will catch up.
        console.error('[webinar/status] sync failed (non-fatal):', err)
      }
    }

    const webinar: any = Array.isArray((data as any).webinar) ? (data as any).webinar[0] : (data as any).webinar
    const confirmed = data.status === 'paid' || data.status === 'free'

    return apiSuccess(
      {
        status: data.status,
        fullName: data.full_name,
        amount: data.amount != null ? Number(data.amount) : null,
        paymentId: confirmed ? data.payment_id : null,
        webinar: webinar
          ? { title: webinar.title, startsAt: webinar.starts_at, joinUrl: confirmed ? webinar.join_url : null }
          : null,
      },
      'OK'
    )
  } catch (err: any) {
    console.error('[webinar/status] unhandled error:', err)
    return apiError('Something went wrong. Please try again.', 500)
  }
}
