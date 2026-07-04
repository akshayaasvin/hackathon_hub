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
