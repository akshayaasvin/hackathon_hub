import crypto from 'crypto'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail, approvalEmailHtml, rejectionEmailHtml } from '@/lib/email'
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

    const { action, userId, reason } = body || {}
    if (!userId || (action !== 'approve' && action !== 'reject')) {
      return apiError('Invalid request — expected { action: "approve"|"reject", userId }.', 400)
    }

    let admin
    try {
      admin = createAdminClient()
    } catch (err: any) {
      console.error('[approvals] createAdminClient failed:', err)
      return apiError('Something went wrong. Please try again later.', 500)
    }

    const { data: targetUser, error: fetchError } = await admin
      .from('users')
      .select('*')
      .eq('id', userId)
      .single()

    if (fetchError || !targetUser) {
      return apiError('User not found.', 404)
    }
    if (targetUser.role !== 'college' && targetUser.role !== 'jury') {
      return apiError('Only college/jury accounts go through approval.', 400)
    }

    if (action === 'reject') {
      await admin
        .from('users')
        .update({ status: 'rejected', updated_at: new Date().toISOString() })
        .eq('id', userId)

      // Lock the account at the Supabase Auth layer too — not just our own
      // middleware status check — so a rejected applicant truly can't sign
      // in, while still keeping the users/profile rows for audit history.
      try {
        await admin.auth.admin.updateUserById(userId, { ban_duration: '876000h' })
      } catch (err) {
        console.error('[approvals] failed to ban rejected user:', err)
      }

      await sendEmail({
        to: targetUser.email,
        subject: 'HackathonHub registration update',
        html: rejectionEmailHtml({ fullName: targetUser.full_name || 'there', reason }),
      })

      return apiSuccess({ status: 'rejected' }, 'Registration rejected.')
    }

    // action === 'approve'
    const tempPassword = randomPassword()

    const { error: updateError } = await admin.auth.admin.updateUserById(userId, {
      password: tempPassword,
      email_confirm: true,
    })

    if (updateError) {
      // Auth user didn't exist yet (defensive fallback per brief §4.2).
      const { error: createError } = await admin.auth.admin.createUser({
        id: userId,
        email: targetUser.email,
        password: tempPassword,
        email_confirm: true,
      })
      if (createError) {
        console.error('[approvals] createUser fallback failed:', createError)
        return apiError(createError.message, 500)
      }
    }

    const profileTable = targetUser.role === 'college' ? 'college_profiles' : 'jury_profiles'

    await admin
      .from('users')
      .update({ status: 'active', updated_at: new Date().toISOString() })
      .eq('id', userId)

    await admin
      .from(profileTable)
      .update({
        approved_by: adminUser.id,
        approved_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)

    const loginUrl = new URL('/login', request.url).toString()
    await sendEmail({
      to: targetUser.email,
      subject: 'Your HackathonHub account is approved',
      html: approvalEmailHtml({
        fullName: targetUser.full_name || 'there',
        email: targetUser.email,
        password: tempPassword,
        loginUrl,
      }),
    })

    return apiSuccess({ status: 'active' }, 'Account approved.')
  } catch (err: any) {
    console.error('[approvals] unhandled error:', err)
    return apiError('Something went wrong. Please try again.', 500)
  }
}
