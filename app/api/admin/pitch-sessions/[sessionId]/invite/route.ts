import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdminOrAssignedJudge } from '@/lib/requireHackathonStaff'
import { apiSuccess, apiError } from '@/lib/apiResponse'
import { sendEmail } from '@/lib/email'
import { formatDateTimeDMY_IST } from '@/lib/dates'
import { logAdminAction } from '@/lib/auditLog'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Send / resend pitch invites (Phase 4, section C). Bulk "Send invites" only processes teams
// that haven't been invited to THIS session yet (invite_sent_at tracks that, so re-running it
// never double-sends); "Resend to one team" (body.onlyTeamId) bypasses that guard for exactly
// one team. Optional auto-assign gives each newly-invited team a sequential slot_time, spaced
// by minutesPerTeam, starting at the session's own starts_at — teams keep whatever slot they
// already have (never reassigned by a later bulk send); the admin can still hand-edit a
// specific team's slot_time afterward (see the slots route) if the sequence needs reordering.
export async function POST(request: Request, { params }: { params: { sessionId: string } }) {
  try {
    if (!UUID_RE.test(params.sessionId)) return apiError('Session not found.', 404)

    const admin = createAdminClient()
    const { data: session, error: sessionError } = await admin
      .from('pitch_sessions')
      .select('id, hackathon_id, title, meet_url, starts_at, duration_minutes, round')
      .eq('id', params.sessionId)
      .maybeSingle()
    if (sessionError) throw sessionError
    if (!session) return apiError('Session not found.', 404)

    const staff = await requireAdminOrAssignedJudge(session.hackathon_id)
    if (!staff?.isAdmin) return apiError('Forbidden — admin access required.', 403)

    let body: any = {}
    try {
      body = await request.json()
    } catch {
      // empty body is fine — defaults below
    }
    const onlyTeamId: string | null = typeof body?.onlyTeamId === 'string' ? body.onlyTeamId : null
    const autoAssignSlots = body?.autoAssignSlots === true
    const minutesPerTeam = Number.isFinite(Number(body?.minutesPerTeam)) && Number(body?.minutesPerTeam) > 0
      ? Number(body.minutesPerTeam)
      : session.duration_minutes

    const { data: hackathon } = await admin.from('hackathons').select('name, round2_deadline').eq('id', session.hackathon_id).maybeSingle()
    const isRound2 = session.round === 2

    // Eligibility depends on which round this session is for — a Round 2 (demo meeting)
    // session must NEVER hand its Meet link to a team that wasn't shortlisted, since a team
    // only ever gets to see a session at all once invite_sent_at is set for their slot (RLS,
    // migration 0031's pitch_slots_select_own_team) — this check is the actual gate, not the UI.
    let eligibleTeamIds: string[]
    if (session.round === 2) {
      let shortlistQuery = admin
        .from('team_round_status')
        .select('team_id')
        .eq('hackathon_id', session.hackathon_id)
        .eq('round', 1)
        .eq('shortlisted', true)
      if (onlyTeamId) shortlistQuery = shortlistQuery.eq('team_id', onlyTeamId)
      const { data: shortlistedRows, error: shortlistError } = await shortlistQuery
      if (shortlistError) throw shortlistError
      eligibleTeamIds = Array.from(new Set((shortlistedRows ?? []).map((r) => r.team_id)))
      if (eligibleTeamIds.length === 0) return apiError('No eligible teams found (must be shortlisted for Round 2).', 400)
    } else {
      // Round 1: a Round 1 submission with a presentation_url, for a team under this hackathon
      // (team creation itself already requires an approved registration, so there's no
      // separate "and approved" check left to make here).
      let eligibleQuery = admin
        .from('submissions')
        .select('team_id')
        .eq('hackathon_id', session.hackathon_id)
        .eq('round', 1)
        .not('presentation_url', 'is', null)
      if (onlyTeamId) eligibleQuery = eligibleQuery.eq('team_id', onlyTeamId)
      const { data: eligibleRows, error: eligibleError } = await eligibleQuery
      if (eligibleError) throw eligibleError
      eligibleTeamIds = Array.from(new Set((eligibleRows ?? []).map((r) => r.team_id)))
      if (eligibleTeamIds.length === 0) return apiError('No eligible teams found (submitted Round 1 presentation link required).', 400)
    }

    const { data: existingSlots } = await admin.from('pitch_slots').select('team_id, invite_sent_at').eq('session_id', session.id)
    const alreadySent = new Set((existingSlots ?? []).filter((s) => s.invite_sent_at).map((s) => s.team_id))

    const targetTeamIds = onlyTeamId ? [onlyTeamId] : eligibleTeamIds.filter((id) => !alreadySent.has(id))
    if (targetTeamIds.length === 0) return apiSuccess({ sent: 0 }, 'Every eligible team has already been invited.')

    let slotCursor = new Date(session.starts_at).getTime()
    let sent = 0
    for (const teamId of targetTeamIds) {
      const slotTime = autoAssignSlots ? new Date(slotCursor).toISOString() : null
      if (autoAssignSlots) slotCursor += minutesPerTeam * 60_000

      const { error: upsertError } = await admin
        .from('pitch_slots')
        .upsert(
          { session_id: session.id, team_id: teamId, slot_time: slotTime, status: 'scheduled', invite_sent_at: new Date().toISOString() },
          { onConflict: 'session_id,team_id' }
        )
      if (upsertError) {
        console.error('[pitch-sessions/invite] slot upsert failed for team', teamId, upsertError)
        continue
      }

      const { data: team } = await admin.from('teams').select('team_name').eq('id', teamId).maybeSingle()
      const { data: members } = await admin.from('team_members').select('user_id').eq('team_id', teamId)
      const userIds = (members ?? []).map((m) => m.user_id)
      if (userIds.length === 0) continue
      const { data: users } = await admin.from('users').select('id, email, full_name').in('id', userIds)

      const when = formatDateTimeDMY_IST(slotTime || session.starts_at)
      const eventLabel = isRound2 ? 'demo meeting' : 'pitch'
      const round2Reminder = isRound2 && hackathon?.round2_deadline
        ? `<p>Remember to submit your GitHub repo and live demo link before the Round 2 deadline (${formatDateTimeDMY_IST(hackathon.round2_deadline)} IST) if you haven't already.</p>`
        : ''
      await admin.from('notifications').insert(
        userIds.map((id) => ({
          user_id: id,
          title: isRound2 ? 'Round 2 demo meeting invite' : 'Pitch session invite',
          message: `Your team "${team?.team_name || 'Team'}" is invited to the ${eventLabel} for ${hackathon?.name || 'the hackathon'} on ${when} IST. Check your Dashboard for the Meet link.`,
          type: 'pitch_session',
        }))
      )
      for (const u of users ?? []) {
        await sendEmail({
          to: u.email,
          subject: `${isRound2 ? 'Round 2 demo meeting invite' : 'Pitch session invite'} — ${hackathon?.name || 'HackathonHub'}`,
          html: `<p>Hi ${u.full_name || ''},</p><p>Your team <b>${team?.team_name || ''}</b> is invited to the ${eventLabel} for <b>${hackathon?.name || 'the hackathon'}</b>.</p><p><b>Date & time (IST):</b> ${when}</p><p><b>Meet link:</b> <a href="${session.meet_url}">${session.meet_url}</a></p><p>Please join 5 minutes early.</p>${round2Reminder}`,
        })
      }
      sent += 1
    }

    if (sent > 0) {
      await logAdminAction(admin, staff.user.id, isRound2 ? 'round2_invites_sent' : 'round1_invites_sent', session.hackathon_id, {
        sessionId: session.id,
        teamIds: targetTeamIds,
        sent,
      })
    }

    return apiSuccess({ sent }, `Invited ${sent} team${sent === 1 ? '' : 's'}.`)
  } catch (err) {
    console.error('[admin pitch-sessions invite] failed:', err)
    return apiError('Something went wrong. Please try again.', 500)
  }
}
