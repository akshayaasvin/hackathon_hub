import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdminOrAssignedJudge } from '@/lib/requireHackathonStaff'
import { apiSuccess, apiError } from '@/lib/apiResponse'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// "Judges only score (existing flow)" — this route is the actual write path for Round 1/2
// scoring: admin OR a judge assigned to this hackathon (judge_assignments) can submit a
// score, which always lands in THEIR OWN row (team_id, round, judge_id) in
// round_judge_scores — never overwriting another judge's score, which the old single
// team_round_status.score column (still used for attendance/shortlisted/remarks/position, all
// admin-only now) structurally could not have prevented.
export async function POST(request: Request, { params }: { params: { teamId: string } }) {
  try {
    if (!UUID_RE.test(params.teamId)) return apiError('Team not found.', 404)

    const admin = createAdminClient()
    const { data: team, error: teamError } = await admin.from('teams').select('id, hackathon_id').eq('id', params.teamId).maybeSingle()
    if (teamError) throw teamError
    if (!team) return apiError('Team not found.', 404)

    const staff = await requireAdminOrAssignedJudge(team.hackathon_id)
    if (!staff) return apiError('Forbidden.', 403)

    let body: any
    try {
      body = await request.json()
    } catch {
      return apiError('Invalid request body — expected JSON.', 400)
    }
    const round = Number(body?.round)
    if (round !== 1 && round !== 2) return apiError('Invalid round.', 400)
    const score = Number(body?.score)
    if (!Number.isFinite(score) || score < 0 || score > 100) return apiError('Score must be between 0 and 100.', 400)
    const remarks = typeof body?.remarks === 'string' ? body.remarks.slice(0, 2000) : null

    const { error: upsertError } = await admin
      .from('round_judge_scores')
      .upsert(
        { team_id: team.id, hackathon_id: team.hackathon_id, round, judge_id: staff.user.id, score, remarks, updated_at: new Date().toISOString() },
        { onConflict: 'team_id,round,judge_id' }
      )
    if (upsertError) throw upsertError

    return apiSuccess({}, 'Score saved.')
  } catch (err) {
    console.error('[rounds/score] failed:', err)
    return apiError('Something went wrong. Please try again.', 500)
  }
}
