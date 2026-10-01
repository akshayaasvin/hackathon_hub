import { requireAdmin } from '@/lib/requireAdmin'
import { createAdminClient } from '@/lib/supabase/admin'
import { apiSuccess, apiError } from '@/lib/apiResponse'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Hard delete — submissions has no FK pointing AT it (nothing "cascades" at the database
// level). round_judge_scores IS round-scoped (team_id, round, judge_id), so a judge's score
// for exactly the round being deleted is unambiguous and is cascade-deleted alongside it. The
// OLD evaluations table (unique(judge_id, team_id), no round column — predates the Round 1/2
// flow) is deliberately left untouched: it isn't scoped to a round or a specific submission,
// so an evaluation there may represent the team's overall generic scorecard rather than
// anything tied to just this one submission, and auto-deleting it risked erasing a record the
// admin didn't intend to touch. team_round_status (shortlist/attendance/position) is also left
// alone — it holds broader round state than "was a project submitted," and clearing it here
// would silently un-shortlist/un-place a team.
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
    if (ids.length === 0) return apiError('No valid submission ids provided.', 400)

    const admin = createAdminClient()

    const { data: submissions, error: fetchError } = await admin.from('submissions').select('id, team_id, round').in('id', ids)
    if (fetchError) throw fetchError
    if (!submissions || submissions.length === 0) return apiError('None of the selected submissions were found.', 404)

    for (const sub of submissions) {
      await admin.from('round_judge_scores').delete().eq('team_id', sub.team_id).eq('round', sub.round)
    }

    const { error: deleteError } = await admin.from('submissions').delete().in('id', submissions.map((s) => s.id))
    if (deleteError) throw deleteError

    return apiSuccess({ deleted: submissions.length }, `Deleted ${submissions.length} submission${submissions.length === 1 ? '' : 's'} and their scores.`)
  } catch (err) {
    console.error('[admin submissions bulk-delete] failed:', err)
    return apiError('Something went wrong. Please try again.', 500)
  }
}
