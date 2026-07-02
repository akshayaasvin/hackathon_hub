import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail, approvalEmailHtml, rejectionEmailHtml } from '@/lib/email'

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
  const adminUser = await requireAdmin()
  if (!adminUser) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { action, userId, reason } = body || {}
  if (!userId || (action !== 'approve' && action !== 'reject')) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const admin = createAdminClient()

  const { data: targetUser, error: fetchError } = await admin
    .from('users')
    .select('*')
    .eq('id', userId)
    .single()

  if (fetchError || !targetUser) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }
  if (targetUser.role !== 'college' && targetUser.role !== 'jury') {
    return NextResponse.json({ error: 'Only college/jury accounts go through approval' }, { status: 400 })
  }

  if (action === 'reject') {
    await admin
      .from('users')
      .update({ status: 'rejected', updated_at: new Date().toISOString() })
      .eq('id', userId)

    await sendEmail({
      to: targetUser.email,
      subject: 'HackathonHub registration update',
      html: rejectionEmailHtml({ fullName: targetUser.full_name || 'there', reason }),
    })

    return NextResponse.json({ status: 'rejected' })
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
      return NextResponse.json({ error: createError.message }, { status: 500 })
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

  return NextResponse.json({ status: 'active' })
}
