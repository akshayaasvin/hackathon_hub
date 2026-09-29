import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdminOrAssignedJudge } from '@/lib/requireHackathonStaff'
import { apiSuccess, apiError } from '@/lib/apiResponse'

export const dynamic = 'force-dynamic'

// Winners tab data: every shortlisted team (Round 1) with their Round 2 submission, invite
// status, each judge's Round 2 score + average, and current position/special-mention state.
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

    // Round 2 sessions only — a team can also have a Round 1 pitch_slots row (from live pitch
    // scheduling), and without this filter the slot lookup below could pick that one instead.
    const { data: round2Sessions } = await admin.from('pitch_sessions').select('id').eq('hackathon_id', params.id).eq('round', 2)
    const round2SessionIds = (round2Sessions ?? []).map((s) => s.id)

    const [
      { data: teams },
      { data: submissions },
      { data: statuses },
      { data: judgeScores },
      { data: slots },
    ] = await Promise.all([
      admin.from('teams').select('id, team_name').in('id', teamIds),
      admin.from('submissions').select('team_id, repo_link, live_demo_url, demo_video_url, notes, submitted_at').eq('hackathon_id', params.id).eq('round', 2).in('team_id', teamIds),
      admin.from('team_round_status').select('*').eq('hackathon_id', params.id).eq('round', 2).in('team_id', teamIds),
      admin.from('round_judge_scores').select('team_id, judge_id, score, remarks').eq('hackathon_id', params.id).eq('round', 2).in('team_id', teamIds),
      round2SessionIds.length
        ? admin.from('pitch_slots').select('team_id, slot_time, invite_sent_at, session_id').in('team_id', teamIds).in('session_id', round2SessionIds)
        : Promise.resolve({ data: [] as any[] }),
    ])

    const judgeIds = Array.from(new Set((judgeScores ?? []).map((s) => s.judge_id)))
    const { data: judges } = judgeIds.length ? await admin.from('users').select('id, full_name, email').in('id', judgeIds) : { data: [] as any[] }

    const rows = (teams ?? []).map((t) => {
      const scoresForTeam = (judgeScores ?? []).filter((s) => s.team_id === t.id)
      const average = scoresForTeam.length > 0 ? scoresForTeam.reduce((sum, s) => sum + Number(s.score), 0) / scoresForTeam.length : null
      const slot = slots?.find((s) => s.team_id === t.id) || null

      return {
        teamId: t.id,
        teamName: t.team_name,
        submission: submissions?.find((s) => s.team_id === t.id) || null,
        status: statuses?.find((s) => s.team_id === t.id) || null,
        judgeScores: scoresForTeam.map((s) => ({
          judgeId: s.judge_id,
          judgeName: judges?.find((j: any) => j.id === s.judge_id)?.full_name || judges?.find((j: any) => j.id === s.judge_id)?.email || 'Judge',
          score: Number(s.score),
          remarks: s.remarks,
        })),
        averageScore: average,
        slotTime: slot?.slot_time ?? null,
        inviteSent: !!slot?.invite_sent_at,
      }
    })
    rows.sort((a, b) => (b.averageScore ?? -1) - (a.averageScore ?? -1))

    return apiSuccess({ teams: rows })
  } catch (err) {
    console.error('[admin round2 list] failed:', err)
    return apiError('Something went wrong. Please try again.', 500)
  }
}
