import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { sendEmail, renderInternshipEmail } from '@/lib/email'

/**
 * Sends the automatic confirmation email (section 9/10) for one internship registration,
 * using THAT internship's own admin-authored subject/heading/body/CTA/instructions —
 * never hard-coded. Called once a registration reaches a final state: 'registered' (paid,
 * from settleInternship) or immediately for a free internship (from the register route).
 */
export async function sendInternshipConfirmation(admin: SupabaseClient, registrationId: string) {
  const { data, error } = await admin
    .from('internship_registrations')
    .select(
      `id, registration_code, full_name, email, status, assessment_score, assessment_total, assessment_passed,
       payment_id, amount,
       internship:internships(title, topic, start_date, duration_text, is_paid, email_subject, email_heading,
         email_body, email_cta_text, email_cta_link, email_instructions, email_support_contact)`
    )
    .eq('id', registrationId)
    .maybeSingle()
  if (error) throw error
  if (!data) return
  const internship: any = Array.isArray((data as any).internship) ? (data as any).internship[0] : (data as any).internship
  if (!internship) return

  const eligibilityStatus =
    data.assessment_total != null && Number(data.assessment_total) > 0
      ? data.assessment_passed
        ? 'Eligible'
        : 'Not eligible'
      : 'Not required'
  const assessmentStatus = data.assessment_score != null ? 'Completed' : 'Not required'
  const paymentStatus = internship.is_paid ? (data.payment_id ? 'Paid' : 'Pending') : 'Not required (free internship)'

  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || '').replace(/\/+$/, '')
  const internshipLink = siteUrl ? `${siteUrl}/internship/${internship.id ?? ''}` : ''

  const { subject, html } = renderInternshipEmail(
    {
      subject: internship.email_subject,
      heading: internship.email_heading,
      body: internship.email_body,
      ctaText: internship.email_cta_text,
      ctaLink: internship.email_cta_link,
      instructions: internship.email_instructions,
      supportContact: internship.email_support_contact,
    },
    {
      student_name: data.full_name,
      internship_name: internship.title,
      registration_id: data.registration_code,
      assessment_status: assessmentStatus,
      assessment_score: data.assessment_score != null ? `${data.assessment_score}/${data.assessment_total}` : 'N/A',
      eligibility_status: eligibilityStatus,
      payment_status: paymentStatus,
      start_date: internship.start_date || 'To be announced',
      duration: internship.duration_text || 'To be announced',
      next_steps: 'Watch your inbox for updates from the internship team, and keep your Registration ID for reference.',
      internship_link: internshipLink,
    }
  )

  const result: any = await sendEmail({ to: data.email, subject, html })
  if (result?.skipped) console.warn('[internship email] RESEND_API_KEY not set — confirmation not sent for', registrationId)
  else if (result?.error) console.error('[internship email] send failed for', registrationId, result.error)
}
