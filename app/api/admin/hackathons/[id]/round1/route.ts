import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdminOrAssignedJudge } from '@/lib/requireHackathonStaff'
import { apiSuccess, apiError } from '@/lib/apiResponse'

export const dynamic = 'force-dynamic'

// Round 1 shortlist list (Phase 4, section D): every team's PPT link, slot, attendance,
// score, remarks, and shortlisted state, for the admin/judge review UI. A judge sees every
// team here (Phase 4 doesn't scope Round 1 review to judge_assignments the way evaluations
// are per-team-assigned — it says "Admin/judge list", not "assigned teams only" — assignment
// still gates the broader Round 1/Round 2 route access itself via requireAdminOrAssignedJudge).
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    const staff = await requireAdminOrAssignedJudge(params.id)
    if (!staff) return apiError('Forbidden.', 403)

    const admin = createAdminClient()
    const { data: teams, error: teamsError } = await admin
      .from('teams')
      .select('id, team_name')
      .eq('hackathon_id', params.id)
    if (teamsError) throw teamsError
    if (!teams || teams.length === 0) return apiSuccess({ teams: [] })

    const teamIds = teams.map((t) => t.id)
    const [{ data: submissions }, { data: statuses }, { data: slots }] = await Promise.all([
      admin.from('submissions').select('team_id, presentation_url, submitted_at').eq('hackathon_id', params.id).eq('round', 1).in('team_id', teamIds),
      admin.from('team_round_status').select('*').eq('hackathon_id', params.id).eq('round', 1).in('team_id', teamIds),
      admin.from('pitch_slots').select('team_id, slot_time, status, invite_sent_at, session_id').in('team_id', teamIds),
    ])

    const rows = teams.map((t) => ({
      teamId: t.id,
      teamName: t.team_name,
      submission: submissions?.find((s) => s.team_id === t.id) || null,
      status: statuses?.find((s) => s.team_id === t.id) || null,
      slot: slots?.find((s) => s.team_id === t.id) || null,
    }))

    return apiSuccess({ teams: rows })
  } catch (err) {
    console.error('[admin round1 list] failed:', err)
    return apiError('Something went wrong. Please try again.', 500)
  }
}
