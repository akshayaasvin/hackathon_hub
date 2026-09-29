import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdminOrAssignedJudge } from '@/lib/requireHackathonStaff'
import { apiSuccess, apiError } from '@/lib/apiResponse'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Admin/judge sets Round 2 score/remarks; admin also sets final position / special mention
// here (a judge can score, but position/special_mention are admin-only, matching "admin sets
// positions ... and publishes").
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
    if (body.score !== undefined) {
      const score = Number(body.score)
      if (!Number.isFinite(score) || score < 0 || score > 100) return apiError('Score must be between 0 and 100.', 400)
      patch.score = score
    }
    if (body.remarks !== undefined) patch.remarks = typeof body.remarks === 'string' ? body.remarks.slice(0, 2000) : null

    if (body.position !== undefined || body.specialMention !== undefined || body.specialMentionLabel !== undefined) {
      if (!staff.isAdmin) return apiError('Only an admin can set position or special mention.', 403)
      if (body.position !== undefined) {
        const position = body.position === null ? null : Number(body.position)
        if (position !== null && (!Number.isFinite(position) || position < 1)) return apiError('Invalid position.', 400)
        patch.position = position
      }
      if (body.specialMention !== undefined) patch.special_mention = !!body.specialMention
      if (body.specialMentionLabel !== undefined) patch.special_mention_label = typeof body.specialMentionLabel === 'string' ? body.specialMentionLabel.slice(0, 200) : null
    }

    if (Object.keys(patch).length === 0) return apiError('Nothing to update.', 400)

    const { error: upsertError } = await admin
      .from('team_round_status')
      .upsert(
        { team_id: team.id, hackathon_id: team.hackathon_id, round: 2, scored_by: staff.user.id, updated_at: new Date().toISOString(), ...patch },
        { onConflict: 'team_id,round' }
      )
    if (upsertError) throw upsertError

    return apiSuccess({}, 'Saved.')
  } catch (err) {
    console.error('[admin round2 update] failed:', err)
    return apiError('Something went wrong. Please try again.', 500)
  }
}
