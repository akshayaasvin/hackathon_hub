import { requireAdmin } from '@/lib/requireAdmin'
import { createAdminClient } from '@/lib/supabase/admin'
import { apiSuccess, apiError } from '@/lib/apiResponse'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Nothing references certificates.id, so this only ever deletes the certificate record
// itself — never the winner/team/submission it was issued for.
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
    if (ids.length === 0) return apiError('No valid certificate ids provided.', 400)

    const admin = createAdminClient()
    const { error, count } = await admin.from('certificates').delete({ count: 'exact' }).in('id', ids)
    if (error) throw error

    return apiSuccess({ deleted: count ?? ids.length }, `Deleted ${count ?? ids.length} certificate${(count ?? ids.length) === 1 ? '' : 's'}.`)
  } catch (err) {
    console.error('[admin certificates bulk-delete] failed:', err)
    return apiError('Something went wrong. Please try again.', 500)
  }
}
