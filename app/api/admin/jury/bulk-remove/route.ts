import { requireAdmin } from '@/lib/requireAdmin'
import { createAdminClient } from '@/lib/supabase/admin'
import { apiSuccess, apiError } from '@/lib/apiResponse'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// "Delete selected" on the Jury Members table = remove them from the jury panel, never the
// auth user: deletes their jury_profiles row and every judge_assignments row they hold (so
// they stop being assigned to any team), but leaves public.users/auth.users and their 'jury'
// role completely untouched — they can still log in, they just have no profile or
// assignments left. round_judge_scores/evaluations they already submitted are left in place
// as the historical record of what they scored; only their ability to score going forward
// (the assignment) is removed.
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
    if (ids.length === 0) return apiError('No valid jury member ids provided.', 400)

    const admin = createAdminClient()

    const { data: juryUsers, error: fetchError } = await admin.from('users').select('id, role').in('id', ids)
    if (fetchError) throw fetchError
    const targetIds = (juryUsers ?? []).filter((u) => u.role === 'jury').map((u) => u.id)
    if (targetIds.length === 0) return apiError('None of the selected users are jury members.', 400)

    await admin.from('judge_assignments').delete().in('judge_id', targetIds)
    const { error: profileError } = await admin.from('jury_profiles').delete().in('user_id', targetIds)
    if (profileError) throw profileError

    return apiSuccess({ removed: targetIds.length }, `Removed ${targetIds.length} jury member${targetIds.length === 1 ? '' : 's'} from the panel.`)
  } catch (err) {
    console.error('[admin jury bulk-remove] failed:', err)
    return apiError('Something went wrong. Please try again.', 500)
  }
}
