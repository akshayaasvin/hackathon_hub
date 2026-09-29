import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdminOrAssignedJudge } from '@/lib/requireHackathonStaff'
import { apiSuccess, apiError } from '@/lib/apiResponse'
import { sendEmail } from '@/lib/email'
import { logAdminAction } from '@/lib/auditLog'

// "Publish" for Winners (Phase 4) — flips hackathons.results_published_final (the RLS gate on
// team_round_status round=2, same pattern as Round 1's publish) and mirrors any team with a
// position into the EXISTING public.winners table, so the pre-existing Results page and
// Certificates page (which already read winners.rank) keep working unchanged rather than
// needing their own rewrite for a second, parallel "winners" concept.
export async function POST(_request: Request, { params }: { params: { id: string } }) {
  try {
    const staff = await requireAdminOrAssignedJudge(params.id)
    if (!staff?.isAdmin) return apiError('Forbidden — admin access required.', 403)

    const admin = createAdminClient()
    const { data: hackathon, error: hackathonError } = await admin
      .from('hackathons')
      .select('name, results_published_round1')
      .eq('id', params.id)
      .maybeSingle()
    if (hackathonError) throw hackathonError
    if (!hackathon) return apiError('Hackathon not found.', 404)
    if (!hackathon.results_published_round1) {
      return apiError('Round 1 results must be published before winners can be announced.', 409)
    }

    const { error: updateError } = await admin
      .from('hackathons')
      .update({ results_published_final: true })
      .eq('id', params.id)
    if (updateError) throw updateError

    const { data: statuses, error: statusError } = await admin
      .from('team_round_status')
      .select('team_id, position, special_mention, special_mention_label')
      .eq('hackathon_id', params.id)
      .eq('round', 2)
    if (statusError) throw statusError

    const placed = (statuses ?? []).filter((s) => s.position != null || s.special_mention)
    for (const s of placed) {
      await admin.from('winners').upsert(
        {
          hackathon_id: params.id,
          team_id: s.team_id,
          rank: s.position,
          special_mention: s.special_mention,
          special_mention_label: s.special_mention_label,
        },
        { onConflict: 'hackathon_id,team_id' }
      )
    }

    // Certificates — the old evaluations-based /results and /admin/results "Declare Winners"
    // flow generated these itself; this route is the rounds-based equivalent, so it must too,
    // or a rounds-based hackathon's winners would never get one. Positions 1-3 get 'winner',
    // a special-mention-only team gets 'finalist' (no numeric rank to justify 'winner'); clear
    // any prior winner/finalist certs for this hackathon first so re-running Announce (e.g.
    // after fixing a position) doesn't leave stale duplicates.
    await admin.from('certificates').delete().eq('hackathon_id', params.id).in('certificate_type', ['winner', 'finalist'])
    const year = new Date().getFullYear()
    const genCertificateId = () => `HH-${year}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`
    for (const s of placed) {
      const { data: members } = await admin.from('team_members').select('user_id').eq('team_id', s.team_id)
      const certType = s.position != null && s.position <= 3 ? 'winner' : 'finalist'
      const certsToInsert = (members ?? []).map((m) => ({
        user_id: m.user_id,
        hackathon_id: params.id,
        certificate_type: certType,
        certificate_id: genCertificateId(),
        issued_at: new Date().toISOString(),
      }))
      if (certsToInsert.length > 0) await admin.from('certificates').insert(certsToInsert)
    }

    let notified = 0
    for (const s of statuses ?? []) {
      const { data: team } = await admin.from('teams').select('team_name').eq('id', s.team_id).maybeSingle()
      const { data: members } = await admin.from('team_members').select('user_id').eq('team_id', s.team_id)
      const userIds = (members ?? []).map((m) => m.user_id)
      if (userIds.length === 0) continue
      const { data: users } = await admin.from('users').select('id, email, full_name').in('id', userIds)

      const outcome = s.position
        ? `🎉 Congratulations! "${team?.team_name || 'Your team'}" placed #${s.position}!`
        : s.special_mention
        ? `🎉 Congratulations! "${team?.team_name || 'Your team'}" received a special mention${s.special_mention_label ? ` (${s.special_mention_label})` : ''}!`
        : `Thank you for participating. Final results for "${team?.team_name || 'your team'}" are now published.`

      await admin.from('notifications').insert(
        userIds.map((id) => ({ user_id: id, title: 'Final results published', message: `${outcome} — ${hackathon.name}`, type: 'round_results' }))
      )
      for (const u of users ?? []) {
        await sendEmail({ to: u.email, subject: `Final results — ${hackathon.name}`, html: `<p>Hi ${u.full_name || ''},</p><p>${outcome}</p><p>Check the Results and Certificates pages for details.</p>` })
      }
      notified += 1
    }

    await logAdminAction(admin, staff.user.id, 'winners_announced', params.id, {
      placed: placed.map((s) => ({ teamId: s.team_id, position: s.position, specialMention: s.special_mention })),
      notified,
    })

    return apiSuccess({ notified }, 'Final results published.')
  } catch (err) {
    console.error('[admin round2 publish] failed:', err)
    return apiError('Something went wrong. Please try again.', 500)
  }
}
