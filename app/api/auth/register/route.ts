import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { registerSchema } from '@/lib/validation'

function randomPassword() {
  return crypto.randomBytes(18).toString('base64url')
}

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const parsed = registerSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || 'Invalid input' },
      { status: 400 }
    )
  }
  const input = parsed.data

  // College/jury don't pick a password at registration time — admin issues
  // a temporary one by email once the account is approved (brief §4.2).
  const email = input.role === 'college' ? input.official_email : input.email
  const password = input.role === 'participant' ? input.password : randomPassword()
  const fullName =
    input.role === 'participant'
      ? input.full_name
      : input.role === 'college'
        ? input.representative_name
        : input.full_name

  const supabase = await createClient()
  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email,
    password,
  })

  if (signUpError || !signUpData.user) {
    return NextResponse.json(
      { error: signUpError?.message || 'Registration failed' },
      { status: 400 }
    )
  }

  const userId = signUpData.user.id
  const admin = createAdminClient()
  const status = input.role === 'participant' ? 'active' : 'pending'

  const { error: usersError } = await admin.from('users').insert({
    id: userId,
    email,
    full_name: fullName,
    role: input.role,
    status,
  })

  if (usersError) {
    try {
      await admin.auth.admin.deleteUser(userId)
    } catch {}
    return NextResponse.json({ error: 'Could not create account. Please try again.' }, { status: 500 })
  }

  let profileError = null
  if (input.role === 'participant') {
    const { error } = await admin.from('participant_profiles').insert({
      user_id: userId,
      college_name: input.college_name,
      passout_year: input.passout_year,
      degree: input.degree,
      domain: input.domain,
      experience_level: input.experience_level,
      contact_number: input.contact_number,
      address: input.address,
    })
    profileError = error
  } else if (input.role === 'college') {
    const { error } = await admin.from('college_profiles').insert({
      user_id: userId,
      college_name: input.college_name,
      representative_name: input.representative_name,
      position_in_college: input.position_in_college,
      date_of_birth: input.date_of_birth || null,
      official_email: input.official_email,
      personal_email: input.personal_email || null,
      contact_number: input.contact_number,
      department: input.department || null,
      college_address: input.college_address,
    })
    profileError = error
  } else {
    const { error } = await admin.from('jury_profiles').insert({
      user_id: userId,
      full_name: input.full_name,
      contact_number: input.contact_number,
      email: input.email,
      official_email: input.official_email || null,
      organization_name: input.organization_name || null,
      portfolio_url: input.portfolio_url || null,
      occupation: input.occupation,
      experience_years: input.experience_years ?? null,
      date_of_birth: input.date_of_birth || null,
      location: input.location,
    })
    profileError = error
  }

  if (profileError) {
    await admin.from('users').delete().eq('id', userId)
    try {
      await admin.auth.admin.deleteUser(userId)
    } catch {}
    return NextResponse.json(
      { error: 'Could not save your profile details. Please try again.' },
      { status: 500 }
    )
  }

  return NextResponse.json({ role: input.role, status })
}
