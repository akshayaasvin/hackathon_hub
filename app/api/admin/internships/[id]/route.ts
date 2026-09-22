import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/requireAdmin'
import { buildInternshipPayload } from '../route'
import { apiSuccess, apiError } from '@/lib/apiResponse'

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
  topic: z.string().trim().max(200).optional().or(z.literal('')),
  description: z.string().trim().max(5000).optional().or(z.literal('')),
  category: z.string().trim().max(100).optional().or(z.literal('')),
  skillsRequired: z.array(z.string().trim().max(50)).max(30).optional(),
  eligibilityText: z.string().trim().max(2000).optional().or(z.literal('')),
  durationText: z.string().trim().max(100).optional().or(z.literal('')),
  mode: z.enum(['online', 'offline', 'hybrid']),
  startDate: z.string().trim().max(20).optional().or(z.literal('')),
  endDate: z.string().trim().max(20).optional().or(z.literal('')),
  applicationDeadline: z.string().trim().max(20).optional().or(z.literal('')),
  seatsTotal: z.coerce.number().int().positive().optional(),
  isPaid: z.boolean(),
  fee: z.coerce.number().min(0).max(10_000_000),
  assessmentEnabled: z.boolean(),
  assessmentPassingScorePercent: z.coerce.number().int().min(0).max(100),
  assessmentTimeLimitMinutes: z.coerce.number().int().positive().optional(),
  assessmentDrafts: z.array(z.any()).max(50),
  fixedFields: z.array(z.object({ key: z.string(), required: z.boolean() })).max(20),
  questionDrafts: z.array(z.any()).max(25),
  bannerUrl: z.string().trim().max(2000).optional().or(z.literal('')),
  emailSubject: z.string().trim().max(300).optional().or(z.literal('')),
  emailHeading: z.string().trim().max(300).optional().or(z.literal('')),
  emailBody: z.string().trim().max(5000).optional().or(z.literal('')),
  emailCtaText: z.string().trim().max(100).optional().or(z.literal('')),
  emailCtaLink: z.string().trim().max(500).optional().or(z.literal('')),
  emailInstructions: z.string().trim().max(3000).optional().or(z.literal('')),
  emailSupportContact: z.string().trim().max(200).optional().or(z.literal('')),
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
    if (!parsed.success) return apiError(parsed.error.issues[0]?.message || 'Invalid input', 400)

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
