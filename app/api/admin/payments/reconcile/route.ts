import { createAdminClient } from '@/lib/supabase/admin'
import { createRazorpayClient } from '@/lib/razorpay'
import { syncOrder, logPaymentEvent } from '@/lib/payments/settle'
import { requireAdmin } from '@/lib/requireAdmin'
import { apiSuccess, apiError } from '@/lib/apiResponse'

// Admin "Sync payments" button. Re-checks every still-unpaid Razorpay order from the
// last 7 days directly with Razorpay and settles any that were actually captured
// (Hackathon and Webinar alike). Recovers payments whose webhook and browser
// callback both never arrived. Idempotent.
export async function POST() {
  try {
    if (!(await requireAdmin())) return apiError('Forbidden — admin access required.', 403)

    let razorpay
    try {
      razorpay = createRazorpayClient()
    } catch {
      return apiError('Razorpay keys are not configured.', 501)
    }

    const admin = createAdminClient()
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const { data: orders, error } = await admin
      .from('payment_orders')
      .select('razorpay_order_id')
      .in('status', ['created', 'failed'])
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(100)
    if (error) throw error

    const tally: Record<string, number> = {}
    let apiErrors = 0
    for (const o of orders ?? []) {
      try {
        const result = await syncOrder(admin, razorpay, o.razorpay_order_id)
        tally[result.outcome] = (tally[result.outcome] ?? 0) + 1
        await logPaymentEvent(admin, {
          source: 'sync',
          event_type: 'admin.reconcile',
          razorpay_order_id: o.razorpay_order_id,
          outcome: result.outcome,
        })
      } catch (err) {
        apiErrors += 1
        console.error('[reconcile] order sync failed:', o.razorpay_order_id, err)
      }
    }

    return apiSuccess({ checked: orders?.length ?? 0, results: tally, errors: apiErrors }, 'Payments synced.')
  } catch (err: any) {
    console.error('[reconcile] unhandled error:', err)
    return apiError('Something went wrong. Please try again.', 500)
  }
}
