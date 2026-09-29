import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdminOrAssignedJudge } from '@/lib/requireHackathonStaff'
import { apiSuccess, apiError } from '@/lib/apiResponse'

export const dynamic = 'force-dynamic'

// Round 2 scoring list (Winners section) — only shortlisted teams ever have a Round 2 row at
// all (see /api/submissions/round2's own gate), so this naturally only ever lists teams that
// made it through Round 1.
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    const staff = await requireAdminOrAssignedJudge(params.id)
    if (!staff) return apiError('Forbidden.', 403)

    const admin = createAdminClient()
    const { data: shortlisted, error: shortlistError } = await admin
      .from('team_round_status')
      .select('team_id')
      .eq('hackathon_id', params.id)
      .eq('round', 1)
      .eq('shortlisted', true)
    if (shortlistError) throw shortlistError
    const teamIds = (shortlisted ?? []).map((s) => s.team_id)
    if (teamIds.length === 0) return apiSuccess({ teams: [] })

    const [{ data: teams }, { data: submissions }, { data: statuses }] = await Promise.all([
      admin.from('teams').select('id, team_name').in('id', teamIds),
      admin.from('submissions').select('team_id, repo_link, live_demo_url, demo_video_url, notes, submitted_at').eq('hackathon_id', params.id).eq('round', 2).in('team_id', teamIds),
      admin.from('team_round_status').select('*').eq('hackathon_id', params.id).eq('round', 2).in('team_id', teamIds),
    ])

    const rows = (teams ?? []).map((t) => ({
      teamId: t.id,
      teamName: t.team_name,
      submission: submissions?.find((s) => s.team_id === t.id) || null,
      status: statuses?.find((s) => s.team_id === t.id) || null,
    }))

    return apiSuccess({ teams: rows })
  } catch (err) {
    console.error('[admin round2 list] failed:', err)
    return apiError('Something went wrong. Please try again.', 500)
  }
}
