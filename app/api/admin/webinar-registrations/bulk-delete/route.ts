import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/requireAdmin'
import { apiSuccess, apiError } from '@/lib/apiResponse'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const CHUNK_SIZE = 200

const bodySchema = z.object({
  ids: z.array(z.string().regex(UUID_RE)).min(1).max(20_000),
})

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

// Bulk delete for webinar registrations (Priority 4). Deletes by explicit ID list only, in
// chunks of 200. payment_orders rows are removed automatically (ON DELETE CASCADE, migration
// 0023) — webinar registrations have no uploaded files, so there's nothing else to clean up.
// The webinar master record itself is never touched by this route.
export async function POST(request: Request) {
  try {
    if (!(await requireAdmin())) return apiError('Forbidden — admin access required.', 403)

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return apiError('Invalid request body — expected JSON.', 400)
    }
    const parsed = bodySchema.safeParse(body)
    if (!parsed.success) return apiError('Invalid selection.', 400)
    const ids = Array.from(new Set(parsed.data.ids))

    const admin = createAdminClient()

    let deleted = 0
    const failedChunks: number[] = []
    const idChunks = chunk(ids, CHUNK_SIZE)
    for (let i = 0; i < idChunks.length; i++) {
      const { error, count } = await admin
        .from('webinar_registrations')
        .delete({ count: 'exact' })
        .in('id', idChunks[i])
      if (error) {
        console.error(`[webinar bulk-delete] chunk ${i} failed:`, error)
        failedChunks.push(i)
        continue
      }
      deleted += count ?? idChunks[i].length
    }

    if (failedChunks.length > 0) {
      return apiSuccess(
        { deleted, requested: ids.length, failedChunks: failedChunks.length },
        `Deleted ${deleted} of ${ids.length}. ${failedChunks.length} chunk(s) failed — please retry.`
      )
    }
    return apiSuccess({ deleted, requested: ids.length }, `Deleted ${deleted} registration${deleted === 1 ? '' : 's'}.`)
  } catch (err) {
    console.error('[webinar bulk-delete] failed:', err)
    return apiError('Could not delete the selected registrations. Please try again.', 500)
  }
}
