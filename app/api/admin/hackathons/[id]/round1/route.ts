import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdminOrAssignedJudge } from '@/lib/requireHackathonStaff'
import { apiSuccess, apiError } from '@/lib/apiResponse'

export const dynamic = 'force-dynamic'

// Round 1 shortlist tab data: every team that has a Round 1 submission (leader name, member
// count, PPT link, pitch slot/attendance, each assigned judge's score, average, remarks,
// shortlisted state) — the full row shape /admin/results/[hackathonId]'s Tab 1 renders.
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    const staff = await requireAdminOrAssignedJudge(params.id)
    if (!staff) return apiError('Forbidden.', 403)

    const admin = createAdminClient()
    const { data: teams, error: teamsError } = await admin
      .from('teams')
      .select('id, team_name, team_lead_id, is_solo')
      .eq('hackathon_id', params.id)
    if (teamsError) throw teamsError
    if (!teams || teams.length === 0) return apiSuccess({ teams: [] })

    const teamIds = teams.map((t) => t.id)
    const leaderIds = Array.from(new Set(teams.map((t) => t.team_lead_id).filter(Boolean)))

    const [
      { data: submissions },
      { data: statuses },
      { data: slots },
      { data: judgeScores },
      { data: assignments },
      { data: leaders },
      { data: memberRows },
    ] = await Promise.all([
      admin.from('submissions').select('team_id, presentation_url, submitted_at').eq('hackathon_id', params.id).eq('round', 1).in('team_id', teamIds),
      admin.from('team_round_status').select('*').eq('hackathon_id', params.id).eq('round', 1).in('team_id', teamIds),
      admin.from('pitch_slots').select('team_id, slot_time, status, invite_sent_at, session_id').in('team_id', teamIds),
      admin.from('round_judge_scores').select('team_id, judge_id, score, remarks').eq('hackathon_id', params.id).eq('round', 1).in('team_id', teamIds),
      admin.from('judge_assignments').select('team_id, judge_id').eq('hackathon_id', params.id).in('team_id', teamIds),
      leaderIds.length ? admin.from('users').select('id, full_name, email').in('id', leaderIds) : Promise.resolve({ data: [] as any[] }),
      admin.from('team_members').select('team_id').in('team_id', teamIds),
    ])

    const judgeIds = Array.from(new Set((judgeScores ?? []).map((s) => s.judge_id)))
    const { data: judges } = judgeIds.length ? await admin.from('users').select('id, full_name, email').in('id', judgeIds) : { data: [] as any[] }

    const rows = teams
      .map((t) => {
        const submission = submissions?.find((s) => s.team_id === t.id) || null
        if (!submission) return null // Tab 1 is scoped to teams that actually submitted Round 1.

        const scoresForTeam = (judgeScores ?? []).filter((s) => s.team_id === t.id)
        const average = scoresForTeam.length > 0 ? scoresForTeam.reduce((sum, s) => sum + Number(s.score), 0) / scoresForTeam.length : null
        const assignedJudgeCount = (assignments ?? []).filter((a) => a.team_id === t.id).length
        const memberCount = (memberRows ?? []).filter((m) => m.team_id === t.id).length
        const leader = leaders?.find((l: any) => l.id === t.team_lead_id) || null

        return {
          teamId: t.id,
          teamName: t.team_name,
          isSolo: t.is_solo,
          leaderName: leader?.full_name || leader?.email || null,
          memberCount,
          submission,
          status: statuses?.find((s) => s.team_id === t.id) || null,
          slot: slots?.find((s) => s.team_id === t.id) || null,
          judgeScores: scoresForTeam.map((s) => ({
            judgeId: s.judge_id,
            judgeName: judges?.find((j: any) => j.id === s.judge_id)?.full_name || judges?.find((j: any) => j.id === s.judge_id)?.email || 'Judge',
            score: Number(s.score),
            remarks: s.remarks,
          })),
          averageScore: average,
          assignedJudgeCount,
          scoredJudgeCount: scoresForTeam.length,
        }
      })
      .filter((r): r is NonNullable<typeof r> => r !== null)
      .sort((a, b) => (b.averageScore ?? -1) - (a.averageScore ?? -1))

    return apiSuccess({ teams: rows })
  } catch (err) {
    console.error('[admin round1 list] failed:', err)
    return apiError('Something went wrong. Please try again.', 500)
  }
}
