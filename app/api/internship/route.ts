import { createAdminClient } from '@/lib/supabase/admin'
import { apiSuccess, apiError } from '@/lib/apiResponse'

export const dynamic = 'force-dynamic'

// Public (no login) internship listing — section 3. Explicit column list: never selects
// assessment_questions (which holds correct answers) or email_* content.
export async function GET() {
  try {
    const admin = createAdminClient()
    const { data, error } = await admin
      .from('internships')
      .select(
        `id, title, topic, description, category, skills_required, eligibility_text,
         duration_text, mode, start_date, end_date, application_deadline, seats_total,
         is_paid, fee, currency, assessment_enabled, banner_url`
      )
      .eq('status', 'published')
      .is('deleted_at', null)
      .order('application_deadline', { ascending: true, nullsFirst: false })
    if (error) throw error

    const internships = data ?? []
    let seatsTakenById = new Map<string, number>()
    if (internships.length > 0) {
      const { data: counts } = await admin
        .from('internship_registrations')
        .select('internship_id')
        .in('internship_id', internships.map((i) => i.id))
        .in('status', ['eligible', 'payment_pending', 'registered', 'active', 'completed', 'certificate_issued'])
      seatsTakenById = new Map()
      for (const r of counts ?? []) seatsTakenById.set(r.internship_id, (seatsTakenById.get(r.internship_id) ?? 0) + 1)
    }

    return apiSuccess(
      {
        internships: internships.map((i) => ({
          ...i,
          seatsTaken: seatsTakenById.get(i.id) ?? 0,
          seatsAvailable: i.seats_total != null ? Math.max(0, i.seats_total - (seatsTakenById.get(i.id) ?? 0)) : null,
        })),
      },
      'OK'
    )
  } catch (err) {
    console.error('[internship list] failed:', err)
    return apiError('Could not load internships.', 500)
  }
}
