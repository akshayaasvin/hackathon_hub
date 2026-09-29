import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdminOrAssignedJudge } from '@/lib/requireHackathonStaff'
import { apiSuccess, apiError } from '@/lib/apiResponse'
import { validateMeetUrl } from '@/lib/roundSubmissions'
import { sendEmail } from '@/lib/email'
import { formatDateTimeDMY_IST } from '@/lib/dates'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function PUT(request: Request, { params }: { params: { sessionId: string } }) {
  try {
    if (!UUID_RE.test(params.sessionId)) return apiError('Session not found.', 404)

    const admin = createAdminClient()
    const { data: existing, error: existingError } = await admin
      .from('pitch_sessions')
      .select('id, hackathon_id, title, meet_url, starts_at, duration_minutes')
      .eq('id', params.sessionId)
      .maybeSingle()
    if (existingError) throw existingError
    if (!existing) return apiError('Session not found.', 404)

    const staff = await requireAdminOrAssignedJudge(existing.hackathon_id)
    if (!staff?.isAdmin) return apiError('Forbidden — admin access required.', 403)

    let body: any
    try {
      body = await request.json()
    } catch {
      return apiError('Invalid request body — expected JSON.', 400)
    }

    const title = typeof body?.title === 'string' ? body.title.trim() : ''
    const startsAt = typeof body?.startsAt === 'string' ? body.startsAt : ''
    const durationMinutes = Number(body?.durationMinutes)
    const notes = typeof body?.notes === 'string' ? body.notes.trim() : null
    const notifyChange = body?.notifyChange === true

    const fieldErrors: Record<string, string> = {}
    if (!title) fieldErrors.title = 'Title is required.'
    const meetUrl = validateMeetUrl(typeof body?.meetUrl === 'string' ? body.meetUrl : '')
    if (meetUrl.ok === false) fieldErrors.meetUrl = meetUrl.message
    const startDate = new Date(startsAt)
    if (!startsAt || Number.isNaN(startDate.getTime())) fieldErrors.startsAt = 'Enter a valid date and time.'
    if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) fieldErrors.durationMinutes = 'Enter a duration in minutes.'
    if (Object.keys(fieldErrors).length > 0) return apiError('Please fix the highlighted fields.', 400, fieldErrors)

    const timeChanged = existing.starts_at !== startDate.toISOString()
    const linkChanged = existing.meet_url !== (meetUrl.ok ? meetUrl.url : existing.meet_url)

    const { error: updateError } = await admin
      .from('pitch_sessions')
      .update({
        title,
        meet_url: meetUrl.ok ? meetUrl.url : existing.meet_url,
        starts_at: startDate.toISOString(),
        duration_minutes: durationMinutes,
        notes,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)
    if (updateError) throw updateError

    // "If the admin edits date/time/link after sending, prompt: 'Notify teams of the
    // change?'" — the prompt itself is client-side (see the admin UI); notifyChange:true is
    // what the client sends once the organizer confirms it.
    if (notifyChange && (timeChanged || linkChanged)) {
      const { data: hackathon } = await admin.from('hackathons').select('name').eq('id', existing.hackathon_id).maybeSingle()
      const { data: slots } = await admin
        .from('pitch_slots')
        .select('team_id, slot_time')
        .eq('session_id', existing.id)
        .not('invite_sent_at', 'is', null)

      for (const slot of slots ?? []) {
        const { data: members } = await admin.from('team_members').select('user_id').eq('team_id', slot.team_id)
        const { data: team } = await admin.from('teams').select('team_name').eq('id', slot.team_id).maybeSingle()
        const userIds = (members ?? []).map((m) => m.user_id)
        if (userIds.length === 0) continue
        const { data: users } = await admin.from('users').select('id, email, full_name').in('id', userIds)

        const when = formatDateTimeDMY_IST(slot.slot_time || startDate.toISOString())
        await admin.from('notifications').insert(
          userIds.map((id) => ({
            user_id: id,
            title: 'Pitch session updated',
            message: `The schedule for "${title}" (${hackathon?.name || 'your hackathon'}) changed. New time: ${when} IST. Check your Dashboard for the updated Meet link.`,
            type: 'pitch_session',
          }))
        )
        for (const u of users ?? []) {
          await sendEmail({
            to: u.email,
            subject: `Pitch session updated — ${team?.team_name || 'Your team'}`,
            html: `<p>Hi ${u.full_name || ''},</p><p>The schedule for your pitch session ("${title}") has changed.</p><p><b>New time (IST):</b> ${when}</p><p><b>Meet link:</b> <a href="${meetUrl.ok ? meetUrl.url : existing.meet_url}">${meetUrl.ok ? meetUrl.url : existing.meet_url}</a></p><p>Please join 5 minutes early.</p>`,
          })
        }
      }
    }

    return apiSuccess({}, 'Session updated.')
  } catch (err) {
    console.error('[admin pitch-sessions update] failed:', err)
    return apiError('Something went wrong. Please try again.', 500)
  }
}

export async function DELETE(_request: Request, { params }: { params: { sessionId: string } }) {
  try {
    if (!UUID_RE.test(params.sessionId)) return apiError('Session not found.', 404)

    const admin = createAdminClient()
    const { data: existing } = await admin.from('pitch_sessions').select('hackathon_id').eq('id', params.sessionId).maybeSingle()
    if (!existing) return apiError('Session not found.', 404)

    const staff = await requireAdminOrAssignedJudge(existing.hackathon_id)
    if (!staff?.isAdmin) return apiError('Forbidden — admin access required.', 403)

    const { error } = await admin.from('pitch_sessions').delete().eq('id', params.sessionId)
    if (error) throw error

    return apiSuccess({}, 'Session deleted.')
  } catch (err) {
    console.error('[admin pitch-sessions delete] failed:', err)
    return apiError('Something went wrong. Please try again.', 500)
  }
}
