import 'server-only'
import { Resend } from 'resend'

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null

export async function sendEmail({ to, subject, html }: { to: string; subject: string; html: string }) {
  if (!resend) {
    console.warn(`[email] RESEND_API_KEY not set — skipping email to ${to}: "${subject}"`)
    return { skipped: true }
  }
  const from = process.env.RESEND_FROM_EMAIL || 'HackathonHub <onboarding@resend.dev>'
  const { error } = await resend.emails.send({ from, to, subject, html })
  if (error) {
    console.error('[email] send failed', error)
  }
  return { error }
}

export function approvalEmailHtml({
  fullName,
  email,
  password,
  loginUrl,
}: {
  fullName: string
  email: string
  password: string
  loginUrl: string
}) {
  return `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
      <h2>Welcome to HackathonHub, ${fullName}!</h2>
      <p>Your registration has been approved. Here are your login credentials:</p>
      <table style="border-collapse: collapse; margin: 16px 0;">
        <tr><td style="padding: 4px 12px 4px 0;"><b>Email</b></td><td>${email}</td></tr>
        <tr><td style="padding: 4px 12px 4px 0;"><b>Temporary password</b></td><td>${password}</td></tr>
      </table>
      <p>Please log in and change your password from your profile page as soon as possible.</p>
      <p><a href="${loginUrl}" style="display:inline-block;background:#6C47FF;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;">Log In</a></p>
    </div>
  `
}

export function rejectionEmailHtml({ fullName, reason }: { fullName: string; reason?: string }) {
  return `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
      <h2>Update on your HackathonHub registration</h2>
      <p>Hi ${fullName},</p>
      <p>Unfortunately your registration was not approved.</p>
      ${reason ? `<p><b>Reason:</b> ${reason}</p>` : ''}
      <p>If you believe this is a mistake, please contact the organizers.</p>
    </div>
  `
}

export function applicationReceivedEmailHtml({ fullName }: { fullName: string }) {
  return `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
      <h2>Application received</h2>
      <p>Hi ${fullName},</p>
      <p>Thanks for applying to HackathonHub. Your application is now with our admin team for review.
      You'll hear back by email once it's been approved — no account or password exists yet, so there's
      nothing to log in with until then.</p>
    </div>
  `
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string)
}

// Small, safe subset of markdown for admin-authored internship email content (section 9):
// **bold**, "- " bullet lists, [text](url) links (http/https only), blank-line paragraphs.
// Escapes first, so nothing the admin pastes can break out of the template as raw HTML.
function miniMarkdownToHtml(text: string): string {
  const escaped = escapeHtml(text)
  const withInline = (s: string) =>
    s
      .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
      .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" style="color:#6C47FF;">$1</a>')

  const blocks = escaped.split(/\n\s*\n/)
  return blocks
    .map((block) => {
      const lines = block.split('\n').map((l) => l.trim()).filter(Boolean)
      if (lines.length === 0) return ''
      if (lines.every((l) => l.startsWith('- '))) {
        return '<ul style="margin:0 0 12px;padding-left:20px;">' + lines.map((l) => `<li>${withInline(l.slice(2))}</li>`).join('') + '</ul>'
      }
      return `<p style="margin:0 0 12px;">${lines.map(withInline).join('<br>')}</p>`
    })
    .join('')
}

/**
 * Fills {{placeholder}} tokens in admin-authored text with dynamic values. Every value is
 * HTML-escaped before substitution — some (student_name, ...) originate from a public
 * registration form, so this is what stops a crafted name from injecting markup into an
 * email whose surrounding text an admin wrote and trusted.
 */
function fillPlaceholders(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (match, key) => {
    const v = vars[key]
    return v !== undefined ? escapeHtml(v) : match
  })
}

export interface InternshipEmailContent {
  subject: string | null
  heading: string | null
  body: string | null
  ctaText: string | null
  ctaLink: string | null
  instructions: string | null
  supportContact: string | null
}

/**
 * Renders the per-internship confirmation email (section 9/10) — every word of subject,
 * heading, body, CTA and instructions comes from the internship's OWN admin-edited content,
 * never hard-coded. Falls back to a plain, complete default only for whatever the admin left
 * blank, so a half-filled email section never produces a broken or empty email.
 */
export function renderInternshipEmail(
  content: InternshipEmailContent,
  vars: {
    student_name: string
    internship_name: string
    registration_id: string
    assessment_status: string
    assessment_score: string
    eligibility_status: string
    payment_status: string
    start_date: string
    duration: string
    next_steps: string
    internship_link: string
  }
): { subject: string; html: string } {
  const subjectTemplate = content.subject?.trim() || 'Internship Registration Confirmed – {{internship_name}}'
  const headingTemplate = content.heading?.trim() || "You're registered, {{student_name}}!"
  const bodyTemplate =
    content.body?.trim() ||
    'Your registration for **{{internship_name}}** has been received.\n\nRegistration ID: {{registration_id}}\nPayment status: {{payment_status}}\nEligibility status: {{eligibility_status}}\n\nNext steps: {{next_steps}}'

  const subject = fillPlaceholders(subjectTemplate, vars)
  const heading = fillPlaceholders(headingTemplate, vars)
  const bodyHtml = miniMarkdownToHtml(fillPlaceholders(bodyTemplate, vars))
  const instructionsHtml = content.instructions?.trim() ? miniMarkdownToHtml(fillPlaceholders(content.instructions, vars)) : ''
  const ctaText = content.ctaText?.trim() ? fillPlaceholders(content.ctaText, vars) : ''
  const ctaLink = content.ctaLink?.trim() || vars.internship_link
  const supportContact = content.supportContact?.trim() ? fillPlaceholders(content.supportContact, vars) : ''

  const html = `
    <div style="font-family: sans-serif; max-width: 520px; margin: 0 auto; color: #0A0E1A;">
      <h2 style="margin:0 0 16px;">${heading}</h2>
      ${bodyHtml}
      ${
        instructionsHtml
          ? `<div style="background:#F8F9FF;border-left:3px solid #6C47FF;padding:12px 16px;margin:16px 0;">${instructionsHtml}</div>`
          : ''
      }
      ${
        ctaText
          ? `<p><a href="${escapeHtml(ctaLink)}" style="display:inline-block;background:#6C47FF;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;">${ctaText}</a></p>`
          : ''
      }
      ${supportContact ? `<p style="font-size:13px;color:#64748B;margin-top:20px;">Questions? Contact ${supportContact}</p>` : ''}
    </div>
  `
  return { subject, html }
}

export function changesRequestedEmailHtml({ fullName, notes }: { fullName: string; notes: string }) {
  return `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
      <h2>Your HackathonHub application needs a small update</h2>
      <p>Hi ${fullName},</p>
      <p>An admin reviewed your application and asked for a change before it can be approved:</p>
      <p style="background:#FFFBEB;border-left:3px solid #D97706;padding:12px 16px;margin:16px 0;">${notes}</p>
      <p>Please submit the registration form again with the correction — resubmitting with the same email
      updates your existing application rather than creating a duplicate.</p>
    </div>
  `
}
