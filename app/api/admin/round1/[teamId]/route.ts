import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdminOrAssignedJudge } from '@/lib/requireHackathonStaff'
import { apiSuccess, apiError } from '@/lib/apiResponse'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const ATTENDANCE_VALUES = ['scheduled', 'presented', 'absent']

// Admin/judge sets Round 1 attendance / score / remarks / shortlisted (Phase 4, section D).
// Upserts team_round_status and, if a pitch slot exists for this team, mirrors attendance
// into pitch_slots.status too so the two views of "did they show up" never disagree.
export async function PUT(request: Request, { params }: { params: { teamId: string } }) {
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

    const patch: Record<string, unknown> = {}
    if (body.attendance !== undefined) {
      if (!ATTENDANCE_VALUES.includes(body.attendance)) return apiError('Invalid attendance value.', 400)
      patch.attendance = body.attendance
    }
    if (body.score !== undefined) {
      const score = Number(body.score)
      if (!Number.isFinite(score) || score < 0 || score > 100) return apiError('Score must be between 0 and 100.', 400)
      patch.score = score
    }
    if (body.remarks !== undefined) patch.remarks = typeof body.remarks === 'string' ? body.remarks.slice(0, 2000) : null
    if (body.shortlisted !== undefined) patch.shortlisted = !!body.shortlisted
    if (Object.keys(patch).length === 0) return apiError('Nothing to update.', 400)

    const { error: upsertError } = await admin
      .from('team_round_status')
      .upsert(
        { team_id: team.id, hackathon_id: team.hackathon_id, round: 1, scored_by: staff.user.id, updated_at: new Date().toISOString(), ...patch },
        { onConflict: 'team_id,round' }
      )
    if (upsertError) throw upsertError

    if (patch.attendance !== undefined) {
      await admin.from('pitch_slots').update({ status: patch.attendance }).eq('team_id', team.id)
    }

    return apiSuccess({}, 'Saved.')
  } catch (err) {
    console.error('[admin round1 update] failed:', err)
    return apiError('Something went wrong. Please try again.', 500)
  }
}
