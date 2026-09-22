import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/requireAdmin'
import { buildInternshipPayload } from '../route'
import { apiSuccess, apiError } from '@/lib/apiResponse'
import { formatZodError } from '@/lib/zodError'
import { optionalText } from '@/lib/zodHelpers'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Full internship record for the admin editor (section 8) — INCLUDES assessment correct
// answers, unlike every public-facing route. Admin-only.
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    if (!(await requireAdmin())) return apiError('Forbidden — admin access required.', 403)
    if (!UUID_RE.test(params.id)) return apiError('Internship not found.', 404)
    const admin = createAdminClient()
    const { data, error } = await admin.from('internships').select('*').eq('id', params.id).maybeSingle()
    if (error) throw error
    if (!data) return apiError('Internship not found.', 404)
    return apiSuccess({ internship: data }, 'OK')
  } catch (err) {
    console.error('[admin internship get] failed:', err)
    return apiError('Something went wrong. Please try again.', 500)
  }
}

const updateBodySchema = z.object({
  title: z.string().trim().min(2, 'Title is required').max(200),
  topic: optionalText(200),
  description: optionalText(5000),
  category: optionalText(100),
  skillsRequired: z.array(z.string().trim().max(50)).max(30).optional(),
  eligibilityText: optionalText(2000),
  durationText: optionalText(100),
  mode: z.enum(['online', 'offline', 'hybrid']),
  startDate: optionalText(20),
  endDate: optionalText(20),
  applicationDeadline: optionalText(20),
  seatsTotal: z.coerce.number().int().positive().optional(),
  isPaid: z.boolean(),
  fee: z.coerce.number().min(0).max(10_000_000),
  assessmentEnabled: z.boolean(),
  assessmentPassingScorePercent: z.coerce.number().int().min(0).max(100),
  assessmentTimeLimitMinutes: z.coerce.number().int().positive().optional(),
  assessmentDrafts: z.array(z.any()).max(50),
  fixedFields: z.array(z.object({ key: z.string(), required: z.boolean() })).max(20),
  questionDrafts: z.array(z.any()).max(25),
  bannerUrl: optionalText(2000),
  emailSubject: optionalText(300),
  emailHeading: optionalText(300),
  emailBody: optionalText(5000),
  emailCtaText: optionalText(100),
  emailCtaLink: optionalText(500),
  emailInstructions: optionalText(3000),
  emailSupportContact: optionalText(200),
  status: z.enum(['draft', 'published', 'closed', 'archived']).optional(),
})

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    if (!(await requireAdmin())) return apiError('Forbidden — admin access required.', 403)
    if (!UUID_RE.test(params.id)) return apiError('Internship not found.', 404)

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return apiError('Invalid request body — expected JSON.', 400)
    }
    const parsed = updateBodySchema.safeParse(body)
    if (!parsed.success) return apiError(formatZodError(parsed.error), 400)

    const built = buildInternshipPayload(parsed.data)
    if (built.ok === false) return apiError(built.message, 400)

    const admin = createAdminClient()
    const payload: Record<string, unknown> = { ...built.payload }
    if (parsed.data.status) payload.status = parsed.data.status

    const { error } = await admin.from('internships').update(payload).eq('id', params.id)
    if (error) throw error

    return apiSuccess({}, 'Internship saved.')
  } catch (err) {
    console.error('[admin internship update] failed:', err)
    return apiError('Something went wrong. Please try again.', 500)
  }
}

// Soft delete only — same reasoning as hackathons (0013): internship_registrations.internship_id
// is `on delete restrict`, and even if it weren't, a real DELETE would erase payment/registration
// history. Setting deleted_at hides it from every list (public and admin) immediately; the row
// and every registration/payment under it stay intact for audit.
export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  try {
    if (!(await requireAdmin())) return apiError('Forbidden — admin access required.', 403)
    if (!UUID_RE.test(params.id)) return apiError('Internship not found.', 404)

    const admin = createAdminClient()
    const { error } = await admin.from('internships').update({ deleted_at: new Date().toISOString() }).eq('id', params.id)
    if (error) throw error

    return apiSuccess({ deleted: true }, 'Internship deleted.')
  } catch (err) {
    console.error('[admin internship delete] failed:', err)
    return apiError('Could not delete internship. Please try again.', 500)
  }
}
