import crypto from 'crypto'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  sendEmail,
  approvalEmailHtml,
  rejectionEmailHtml,
  changesRequestedEmailHtml,
} from '@/lib/email'
import { apiSuccess, apiError } from '@/lib/apiResponse'

function randomPassword() {
  return crypto.randomBytes(9).toString('base64url')
}

async function requireAdmin() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  const { data: userData } = await supabase.from('users').select('role').eq('id', user.id).single()
  if (userData?.role !== 'admin') return null
  return user
}

export async function POST(request: Request) {
  try {
    const adminUser = await requireAdmin()
    if (!adminUser) {
      return apiError('Forbidden — admin access required.', 403)
    }

    let body: any
    try {
      body = await request.json()
    } catch {
      return apiError('Invalid request body — expected JSON.', 400)
    }

    const { action, role, applicationId, reason } = body || {}
    const validActions = ['approve', 'reject', 'request_changes']
    if (!applicationId || !['college', 'jury'].includes(role) || !validActions.includes(action)) {
      return apiError(
        'Invalid request — expected { action, role: "college"|"jury", applicationId, reason? }.',
        400
      )
    }
    if (action === 'request_changes' && !reason?.trim()) {
      return apiError('A note is required so the applicant knows what to fix.', 400)
    }

    let admin
    try {
      admin = createAdminClient()
    } catch (err: any) {
      console.error('[approvals] createAdminClient failed:', err)
      return apiError('Something went wrong. Please try again later.', 500)
    }

    const table = role === 'college' ? 'college_applications' : 'jury_applications'
    const emailColumn = role === 'college' ? 'official_email' : 'email'

    const { data: application, error: fetchError } = await admin
      .from(table)
      .select('*')
      .eq('id', applicationId)
      .single()

    if (fetchError || !application) {
      return apiError('Application not found.', 404)
    }
    if (application.status !== 'pending') {
      return apiError(`This application was already ${application.status}.`, 400)
    }

    const applicantEmail = application[emailColumn]
    const applicantName = role === 'college' ? application.representative_name : application.full_name
    const now = new Date().toISOString()

    if (action === 'reject') {
      await admin
        .from(table)
        .update({ status: 'rejected', reviewed_by: adminUser.id, reviewed_at: now, admin_notes: reason || null, updated_at: now })
        .eq('id', applicationId)

      await sendEmail({
        to: applicantEmail,
        subject: 'HackathonHub application update',
        html: rejectionEmailHtml({ fullName: applicantName, reason }),
      })

      return apiSuccess({ status: 'rejected' }, 'Application rejected.')
    }

    if (action === 'request_changes') {
      await admin
        .from(table)
        .update({ status: 'changes_requested', reviewed_by: adminUser.id, reviewed_at: now, admin_notes: reason, updated_at: now })
        .eq('id', applicationId)

      await sendEmail({
        to: applicantEmail,
        subject: 'HackathonHub application — changes requested',
        html: changesRequestedEmailHtml({ fullName: applicantName, notes: reason }),
      })

      return apiSuccess({ status: 'changes_requested' }, 'Applicant notified.')
    }

    // action === 'approve' — this is the only point where the auth account,
    // users row, and profile row get created.
    const tempPassword = randomPassword()

    const { data: createData, error: createError } = await admin.auth.admin.createUser({
      email: applicantEmail,
      password: tempPassword,
      email_confirm: true,
    })

    if (createError || !createData.user) {
      console.error('[approvals] createUser failed:', createError)
      return apiError(
        createError?.message.includes('already registered')
          ? 'An account with this email already exists.'
          : 'Could not create the account. Please try again.',
        500
      )
    }

    const userId = createData.user.id

    // Upsert, not insert: the on_auth_user_created trigger may have already
    // created a placeholder row (role=participant, status=pending) the
    // instant createUser() ran, before this code got here.
    const { error: usersError } = await admin.from('users').upsert(
      {
        id: userId,
        email: applicantEmail,
        full_name: applicantName,
        role,
        status: 'active',
      },
      { onConflict: 'id' }
    )

    if (usersError) {
      console.error('[approvals] users insert failed:', usersError)
      try {
        await admin.auth.admin.deleteUser(userId)
      } catch {}
      return apiError('Could not finish creating the account. Please try again.', 500)
    }

    let profileError = null
    if (role === 'college') {
      const { error } = await admin.from('college_profiles').insert({
        user_id: userId,
        college_name: application.college_name,
        representative_name: application.representative_name,
        position_in_college: application.position_in_college,
        date_of_birth: application.date_of_birth,
        official_email: application.official_email,
        personal_email: application.personal_email,
        contact_number: application.contact_number,
        department: application.department,
        college_address: application.college_address,
      })
      profileError = error

      // Keep the registration-form dropdown (colleges table, 0015) in sync
      // with every institution that actually onboards — not just the
      // one-time backfill at migration time. Non-fatal: the account is
      // already created either way, this only affects dropdown coverage.
      if (!error) {
        const { error: collegeUpsertError } = await admin
          .from('colleges')
          .upsert({ name: application.college_name }, { onConflict: 'name', ignoreDuplicates: true })
        if (collegeUpsertError) {
          console.error('[approvals] colleges upsert failed (non-fatal):', collegeUpsertError)
        }
      }
    } else {
      const { error } = await admin.from('jury_profiles').insert({
        user_id: userId,
        full_name: application.full_name,
        contact_number: application.contact_number,
        email: application.email,
        official_email: application.official_email,
        organization_name: application.organization_name,
        portfolio_url: application.portfolio_url,
        occupation: application.occupation,
        experience_years: application.experience_years,
        date_of_birth: application.date_of_birth,
        location: application.location,
      })
      profileError = error
    }

    if (profileError) {
      console.error('[approvals] profile insert failed:', profileError)
      await admin.from('users').delete().eq('id', userId)
      try {
        await admin.auth.admin.deleteUser(userId)
      } catch {}
      return apiError('Could not finish creating the account. Please try again.', 500)
    }

    await admin
      .from(table)
      .update({
        status: 'approved',
        reviewed_by: adminUser.id,
        reviewed_at: now,
        created_user_id: userId,
        updated_at: now,
      })
      .eq('id', applicationId)

    const loginUrl = new URL('/login', request.url).toString()
    await sendEmail({
      to: applicantEmail,
      subject: 'Your HackathonHub account is approved',
      html: approvalEmailHtml({
        fullName: applicantName,
        email: applicantEmail,
        password: tempPassword,
        loginUrl,
      }),
    })

    return apiSuccess(
      { status: 'active', email: applicantEmail, password: tempPassword },
      'Account approved.'
    )
  } catch (err: any) {
    console.error('[approvals] unhandled error:', err)
    return apiError('Something went wrong. Please try again.', 500)
  }
}
