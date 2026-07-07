import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { apiSuccess, apiError } from '@/lib/apiResponse'

// Cross-college leaderboard. RLS deliberately scopes college_profiles/
// participant_profiles/team_members/users to "your own college only" — a
// college should never be able to browse another college's student roster.
// So this computes the leaderboard server-side with the service-role client
// and returns ONLY aggregate numbers (name, counts, total score) — no
// student names, emails, or any other PII crosses institution boundaries.
export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return apiError('Not authenticated.', 401)

    const { data: callerData } = await supabase.from('users').select('role').eq('id', user.id).single()
    if (!callerData || !['college', 'admin'].includes(callerData.role)) {
      return apiError('Forbidden.', 403)
    }

    let admin
    try {
      admin = createAdminClient()
    } catch (err: any) {
      console.error('[college-leaderboard] createAdminClient failed:', err)
      return apiError('Something went wrong. Please try again later.', 500)
    }

    const [collegeUsersRes, participantsRes, teamMembersRes, evaluationsRes] = await Promise.all([
      admin.from('users').select('id').eq('role', 'college'),
      admin.from('participant_profiles').select('user_id, college_name'),
      admin.from('team_members').select('user_id, team_id'),
      admin.from('evaluations').select('team_id, total_score'),
    ])

    const collegeUserIds = (collegeUsersRes.data || []).map((u: any) => u.id)
    const { data: profiles } = collegeUserIds.length
      ? await admin.from('college_profiles').select('user_id, college_name').in('user_id', collegeUserIds)
      : { data: [] as any[] }

    const participants = participantsRes.data || []
    const teamMembers = teamMembersRes.data || []
    const evaluations = evaluationsRes.data || []

    const leaderboard = (profiles || [])
      .map((profile: any) => {
        const collegeName = profile.college_name
        const collegeStudentUserIds = new Set(
          participants.filter((p: any) => p.college_name === collegeName).map((p: any) => p.user_id)
        )
        const participantCount = collegeStudentUserIds.size

        const teamIds = new Set(
          teamMembers.filter((tm: any) => collegeStudentUserIds.has(tm.user_id)).map((tm: any) => tm.team_id)
        )
        const totalScore = evaluations
          .filter((e: any) => teamIds.has(e.team_id))
          .reduce((sum: number, e: any) => sum + (e.total_score || 0), 0)

        return {
          collegeName,
          participantCount,
          teamsCount: teamIds.size,
          totalScore,
        }
      })
      .filter((c) => c.participantCount > 0)
      .sort((a, b) => (b.totalScore !== a.totalScore ? b.totalScore - a.totalScore : b.participantCount - a.participantCount))

    return apiSuccess({ leaderboard })
  } catch (err: any) {
    console.error('[college-leaderboard] unhandled error:', err)
    return apiError('Something went wrong. Please try again.', 500)
  }
}
