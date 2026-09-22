import crypto from 'crypto'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createRazorpayClient } from '@/lib/razorpay'
import { getOrCreateOrder } from '@/lib/payments/orders'
import { parseFormConfig, validateRegistrationAnswers } from '@/lib/internshipForm'
import { normalizeIndianMobile } from '@/lib/phone'
import { uploadResume } from '@/lib/internshipResume'
import { sendInternshipConfirmation } from '@/lib/internshipEmail'
import { apiSuccess, apiError } from '@/lib/apiResponse'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const bodySchema = z.object({
  registrationId: z.string().uuid().optional(),
  accessToken: z.string().uuid().optional(),
  fullName: z.string().trim().min(2, 'Full name is required').max(100),
  email: z.email('Enter a valid email address').max(254),
  phone: z.string().trim().min(7, 'Enter a valid mobile number').max(20),
  fields: z.record(z.string(), z.unknown()).optional(),
  // Resume as a data: URL (browser reads the file with FileReader before submitting).
  resumeDataUrl: z.string().max(4_500_000).optional(),
})

// Completes internship registration (section 4/6/7) — public, no login required (section 2).
// If the internship has the assessment enabled, this REQUIRES registrationId/accessToken
// from a row that already reached 'eligible' (assessment/submit) — the two-stage flow is
// enforced here, not just in the UI. Paid internships create a Razorpay order (the SAME
// getOrCreateOrder/settlePayment path as Hackathon + Webinar); free internships are
// confirmed immediately and the confirmation email is sent right here.
export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    if (!UUID_RE.test(params.id)) return apiError('Internship not found.', 404)
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return apiError('Invalid request body — expected JSON.', 400)
    }
    const parsed = bodySchema.safeParse(body)
    if (!parsed.success) return apiError(parsed.error.issues[0]?.message || 'Invalid input', 400)

    const phone = normalizeIndianMobile(parsed.data.phone)
    if (!phone) return apiError('Enter a valid 10-digit mobile number.', 400)
    const email = parsed.data.email.trim().toLowerCase()
    const fullName = parsed.data.fullName

    const admin = createAdminClient()
    const { data: internship, error: internshipError } = await admin
      .from('internships')
      .select('id, status, is_paid, fee, currency, assessment_enabled, form_config, deleted_at')
      .eq('id', params.id)
      .maybeSingle()
    if (internshipError) throw internshipError
    if (!internship || internship.status !== 'published' || internship.deleted_at) return apiError('Internship not found.', 404)

    const formConfig = parseFormConfig(internship.form_config)
    const resumeField = formConfig.fixedFields.find((f) => f.key === 'resume')
    const validated = validateRegistrationAnswers(formConfig, parsed.data.fields)
    if (validated.ok === false) return apiError(validated.message, 400)
    if (resumeField?.required && !parsed.data.resumeDataUrl) return apiError('Please attach your resume.', 400)

    // Best-effort: if the visitor happens to have an active HackathonHub session, link this
    // application to their account — read from the session itself, never from the request
    // body (section 13: "associate ... where possible", but login must never be required).
    let studentId: string | null = null
    try {
      const supabase = await createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      studentId = user?.id ?? null
    } catch {
      // no session / cookies unavailable — perfectly normal for a public applicant
    }

    // ── Resolve the registration row ──────────────────────────────────────────────────
    let registrationId: string
    let isNewRow = false
    let accessToken = parsed.data.accessToken ?? ''

    if (parsed.data.registrationId && parsed.data.accessToken) {
      const { data: row, error: rowError } = await admin
        .from('internship_registrations')
        .select('id, status')
        .eq('id', parsed.data.registrationId)
        .eq('internship_id', internship.id)
        .eq('access_token', parsed.data.accessToken)
        .maybeSingle()
      if (rowError) throw rowError
      if (!row) return apiError('Registration session not found. Please start again.', 404)
      if (internship.assessment_enabled && row.status === 'assessment_pending') {
        return apiError('Please complete the eligibility assessment first.', 400)
      }
      if (row.status === 'not_eligible') return apiError('You did not meet the eligibility criteria for this internship.', 403)
      if (row.status === 'registered') return apiError('This application is already registered.', 409)
      registrationId = row.id
    } else {
      if (internship.assessment_enabled) return apiError('Please complete the eligibility assessment first.', 400)

      const { data: existing, error: existingError } = await admin
        .from('internship_registrations')
        .select('id, status')
        .eq('internship_id', internship.id)
        .eq('email', email)
        .maybeSingle()
      if (existingError) throw existingError

      if (existing) {
        if (existing.status === 'registered') return apiError('This email has already registered for this internship.', 409)
        registrationId = existing.id
        // Rotate the token for this fresh submission (same pattern as webinar/hackathon
        // registration): whoever is submitting the form right now is who should be able
        // to poll/confirm this attempt.
        accessToken = crypto.randomUUID()
      } else {
        accessToken = crypto.randomUUID()
        const { data: created, error: insertError } = await admin
          .from('internship_registrations')
          .insert({ internship_id: internship.id, full_name: fullName, email, phone, status: 'applied', access_token: accessToken })
          .select('id')
          .single()
        if (insertError) {
          if ((insertError as any).code === '23505') return apiError('This email has already registered for this internship.', 409)
          throw insertError
        }
        registrationId = created.id
        isNewRow = true
      }
    }

    let resumePath: string | undefined
    if (parsed.data.resumeDataUrl) {
      try {
        resumePath = await uploadResume(admin, parsed.data.resumeDataUrl, internship.id, registrationId)
      } catch (err: any) {
        return apiError(err.message || 'Could not upload resume.', 400)
      }
    }

    const updatePayload: Record<string, unknown> = {
      full_name: fullName,
      phone,
      form_answers: validated.answers,
      updated_at: new Date().toISOString(),
    }
    if (isNewRow) updatePayload.email = email // guarded row already has the right email otherwise
    if (!parsed.data.registrationId) updatePayload.access_token = accessToken // freshly (re)generated above for this submission
    if (studentId) updatePayload.student_id = studentId
    if (resumePath) updatePayload.resume_path = resumePath

    const fee = internship.is_paid ? Number(internship.fee) : 0
    const currency = internship.currency || 'INR'

    if (fee <= 0) {
      const { error } = await admin
        .from('internship_registrations')
        .update({ ...updatePayload, status: 'registered' })
        .eq('id', registrationId)
      if (error) throw error

      const { data: withCode } = await admin.from('internship_registrations').select('registration_code').eq('id', registrationId).maybeSingle()
      await sendInternshipConfirmation(admin, registrationId).catch((err) =>
        console.error('[internship/register] free confirmation email failed (non-fatal):', err)
      )
      return apiSuccess(
        { registrationId, registrationCode: withCode?.registration_code, accessToken, paymentRequired: false },
        'Registration confirmed.'
      )
    }

    const { error: pendingError } = await admin
      .from('internship_registrations')
      .update({ ...updatePayload, status: 'payment_pending' })
      .eq('id', registrationId)
    if (pendingError) throw pendingError

    let razorpay
    try {
      razorpay = createRazorpayClient()
    } catch (err) {
      console.error('[internship/register] razorpay client:', err)
      return apiError('Payments are not configured yet. Please contact the organizers.', 501)
    }

    let order
    try {
      order = await getOrCreateOrder(admin, razorpay, {
        kind: 'internship',
        targetId: registrationId,
        amountRupees: fee,
        currency,
        notes: { internship_id: internship.id },
      })
    } catch (err) {
      console.error('[internship/register] order creation failed:', err)
      return apiError('Could not start payment. Please try again.', 500)
    }

    const { data: withCode } = await admin.from('internship_registrations').select('registration_code').eq('id', registrationId).maybeSingle()
    return apiSuccess(
      { registrationId, registrationCode: withCode?.registration_code, accessToken, paymentRequired: true, order },
      'Order created.'
    )
  } catch (err: any) {
    console.error('[internship/register] unhandled error:', err)
    return apiError('Something went wrong. Please try again.', 500)
  }
}
