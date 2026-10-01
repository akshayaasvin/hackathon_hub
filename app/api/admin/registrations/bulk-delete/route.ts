import { requireAdmin } from '@/lib/requireAdmin'
import { createAdminClient } from '@/lib/supabase/admin'
import { apiSuccess, apiError } from '@/lib/apiResponse'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Soft delete only (migration 0034) — a Razorpay-verified payment record must never be hard
// deleted, and payment_orders (0017) cascades on registrations.id, so a hard delete here would
// also destroy the per-attempt payment audit trail. "Delete selected" just hides the row from
// admin/participant lists; the underlying payment record and its order history are untouched.
export async function POST(request: Request) {
  try {
    const adminUser = await requireAdmin()
    if (!adminUser) return apiError('Forbidden — admin access required.', 403)

    let body: any
    try {
      body = await request.json()
    } catch {
      return apiError('Invalid request body — expected JSON.', 400)
    }
    const ids: string[] = Array.isArray(body?.ids) ? body.ids.filter((id: unknown) => typeof id === 'string' && UUID_RE.test(id)) : []
    if (ids.length === 0) return apiError('No valid registration ids provided.', 400)

    const admin = createAdminClient()
    const { error, count } = await admin
      .from('registrations')
      .update({ deleted_at: new Date().toISOString() }, { count: 'exact' })
      .in('id', ids)
      .is('deleted_at', null)
    if (error) throw error

    return apiSuccess({ deleted: count ?? ids.length }, `Removed ${count ?? ids.length} registration${(count ?? ids.length) === 1 ? '' : 's'} from this list.`)
  } catch (err) {
    console.error('[admin registrations bulk-delete] failed:', err)
    return apiError('Something went wrong. Please try again.', 500)
  }
}
