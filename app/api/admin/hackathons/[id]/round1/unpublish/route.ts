import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdminOrAssignedJudge } from '@/lib/requireHackathonStaff'
import { apiSuccess, apiError } from '@/lib/apiResponse'
import { logAdminAction } from '@/lib/auditLog'

// Undo a Round 1 publish — only while it's still safe to change the shortlist without
// confusing anyone: once a Round 2 (demo meeting) invite has actually gone out to a team
// (pitch_slots.invite_sent_at set on a round=2 session), that team has already seen the
// "you're shortlisted" notification/email/Meet link, so unpublishing at that point would
// silently revoke a promise already made — blocked here, not just discouraged in the UI.
export async function POST(_request: Request, { params }: { params: { id: string } }) {
  try {
    const staff = await requireAdminOrAssignedJudge(params.id)
    if (!staff?.isAdmin) return apiError('Forbidden — admin access required.', 403)

    const admin = createAdminClient()
    const { data: hackathon, error: hackathonError } = await admin.from('hackathons').select('name').eq('id', params.id).maybeSingle()
    if (hackathonError) throw hackathonError
    if (!hackathon) return apiError('Hackathon not found.', 404)

    const { data: round2Sessions, error: sessionsError } = await admin
      .from('pitch_sessions')
      .select('id')
      .eq('hackathon_id', params.id)
      .eq('round', 2)
    if (sessionsError) throw sessionsError
    const sessionIds = (round2Sessions ?? []).map((s) => s.id)

    if (sessionIds.length > 0) {
      const { data: sentSlots, error: slotsError } = await admin
        .from('pitch_slots')
        .select('id')
        .in('session_id', sessionIds)
        .not('invite_sent_at', 'is', null)
        .limit(1)
      if (slotsError) throw slotsError
      if ((sentSlots ?? []).length > 0) {
        return apiError('Cannot unpublish — Round 2 invites have already been sent to shortlisted teams.', 409)
      }
    }

    const { error: updateError } = await admin.from('hackathons').update({ results_published_round1: false }).eq('id', params.id)
    if (updateError) throw updateError

    await logAdminAction(admin, staff.user.id, 'round1_unpublished', params.id, {})

    return apiSuccess({}, 'Round 1 results unpublished.')
  } catch (err) {
    console.error('[admin round1 unpublish] failed:', err)
    return apiError('Something went wrong. Please try again.', 500)
  }
}
