import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdminOrAssignedJudge } from '@/lib/requireHackathonStaff'
import { apiSuccess, apiError } from '@/lib/apiResponse'
import { sendEmail } from '@/lib/email'
import { logAdminAction } from '@/lib/auditLog'

// "Publish Round 1 results" (admin only) — Phase 4, section D. Flips
// hackathons.results_published_round1, which is the actual gate on team_round_status's RLS
// (migration 0031) — until this runs, no participant can read their row at all, regardless of
// what the admin UI shows before that point.
export async function POST(_request: Request, { params }: { params: { id: string } }) {
  try {
    const staff = await requireAdminOrAssignedJudge(params.id)
    if (!staff?.isAdmin) return apiError('Forbidden — admin access required.', 403)

    const admin = createAdminClient()
    const { data: hackathon, error: hackathonError } = await admin.from('hackathons').select('name').eq('id', params.id).maybeSingle()
    if (hackathonError) throw hackathonError
    if (!hackathon) return apiError('Hackathon not found.', 404)

    const { error: updateError } = await admin
      .from('hackathons')
      .update({ results_published_round1: true })
      .eq('id', params.id)
    if (updateError) throw updateError

    const { data: statuses } = await admin
      .from('team_round_status')
      .select('team_id, shortlisted')
      .eq('hackathon_id', params.id)
      .eq('round', 1)

    let notified = 0
    for (const s of statuses ?? []) {
      const { data: team } = await admin.from('teams').select('team_name').eq('id', s.team_id).maybeSingle()
      const { data: members } = await admin.from('team_members').select('user_id').eq('team_id', s.team_id)
      const userIds = (members ?? []).map((m) => m.user_id)
      if (userIds.length === 0) continue
      const { data: users } = await admin.from('users').select('id, email, full_name').in('id', userIds)

      const outcome = s.shortlisted
        ? `🎉 Congratulations! Your team "${team?.team_name || 'Your team'}" is selected for Round 2. Watch your Dashboard for the demo meeting link.`
        : `Thank you for participating. Your team "${team?.team_name || 'Your team'}" was not selected for Round 2.`

      await admin.from('notifications').insert(
        userIds.map((id) => ({
          user_id: id,
          title: 'Round 1 results published',
          message: `${outcome} — ${hackathon.name}`,
          type: 'round_results',
        }))
      )
      for (const u of users ?? []) {
        await sendEmail({
          to: u.email,
          subject: `Round 1 results — ${hackathon.name}`,
          html: `<p>Hi ${u.full_name || ''},</p><p>${outcome}</p>`,
        })
      }
      notified += 1
    }

    await logAdminAction(admin, staff.user.id, 'round1_published', params.id, {
      shortlisted: (statuses ?? []).filter((s) => s.shortlisted).map((s) => s.team_id),
      notShortlisted: (statuses ?? []).filter((s) => !s.shortlisted).map((s) => s.team_id),
      notified,
    })

    return apiSuccess({ notified }, 'Round 1 results published.')
  } catch (err) {
    console.error('[admin round1 publish] failed:', err)
    return apiError('Something went wrong. Please try again.', 500)
  }
}
