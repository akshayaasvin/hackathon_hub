import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdminOrAssignedJudge } from '@/lib/requireHackathonStaff'
import { apiSuccess, apiError } from '@/lib/apiResponse'
import { validateMeetUrl } from '@/lib/roundSubmissions'

export const dynamic = 'force-dynamic'

// Pitch session scheduling (Phase 4, section B) — admin-only create; admin/judge can list.
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    const staff = await requireAdminOrAssignedJudge(params.id)
    if (!staff) return apiError('Forbidden.', 403)

    const admin = createAdminClient()
    const { data, error } = await admin
      .from('pitch_sessions')
      .select('*, pitch_slots(id, team_id, slot_time, status, invite_sent_at)')
      .eq('hackathon_id', params.id)
      .order('starts_at', { ascending: true })
    if (error) throw error

    return apiSuccess({ sessions: data ?? [] })
  } catch (err) {
    console.error('[admin pitch-sessions list] failed:', err)
    return apiError('Something went wrong. Please try again.', 500)
  }
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const staff = await requireAdminOrAssignedJudge(params.id)
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

    const fieldErrors: Record<string, string> = {}
    if (!title) fieldErrors.title = 'Title is required.'
    const meetUrl = validateMeetUrl(typeof body?.meetUrl === 'string' ? body.meetUrl : '')
    if (meetUrl.ok === false) fieldErrors.meetUrl = meetUrl.message
    const startDate = new Date(startsAt)
    if (!startsAt || Number.isNaN(startDate.getTime())) fieldErrors.startsAt = 'Enter a valid date and time.'
    if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) fieldErrors.durationMinutes = 'Enter a duration in minutes.'
    if (Object.keys(fieldErrors).length > 0) return apiError('Please fix the highlighted fields.', 400, fieldErrors)

    const admin = createAdminClient()
    const { data: session, error } = await admin
      .from('pitch_sessions')
      .insert({
        hackathon_id: params.id,
        title,
        meet_url: meetUrl.ok ? meetUrl.url : '',
        starts_at: startDate.toISOString(),
        duration_minutes: durationMinutes,
        notes,
        created_by: staff.user.id,
      })
      .select()
      .single()
    if (error) throw error

    return apiSuccess({ session }, 'Pitch session created.')
  } catch (err) {
    console.error('[admin pitch-sessions create] failed:', err)
    return apiError('Something went wrong. Please try again.', 500)
  }
}
