import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { adminCreateSchema } from '@/lib/validation'

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

// Lets an admin directly create an already-active college/jury account
// (bypassing self-serve registration + approval). Never calls client-side
// signUp — that would swap the caller's own session for the new user's.
export async function POST(request: Request) {
  const adminUser = await requireAdmin()
  if (!adminUser) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const parsed = adminCreateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || 'Invalid input' },
      { status: 400 }
    )
  }
  const input = parsed.data

  const email = input.role === 'college' ? input.official_email : input.email
  const fullName = input.role === 'college' ? input.representative_name : input.full_name

  const admin = createAdminClient()
  const { data: createData, error: createError } = await admin.auth.admin.createUser({
    email,
    password: input.password,
    email_confirm: true,
  })

  if (createError || !createData.user) {
    return NextResponse.json({ error: createError?.message || 'Could not create account' }, { status: 400 })
  }

  const userId = createData.user.id
  const now = new Date().toISOString()

  const { error: usersError } = await admin.from('users').insert({
    id: userId,
    email,
    full_name: fullName,
    role: input.role,
    status: 'active',
  })

  if (usersError) {
    await admin.auth.admin.deleteUser(userId)
    return NextResponse.json({ error: 'Could not create account. Please try again.' }, { status: 500 })
  }

  let profileError = null
  if (input.role === 'college') {
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
      approved_by: adminUser.id,
      approved_at: now,
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
      approved_by: adminUser.id,
      approved_at: now,
    })
    profileError = error
  }

  if (profileError) {
    await admin.from('users').delete().eq('id', userId)
    await admin.auth.admin.deleteUser(userId)
    return NextResponse.json(
      { error: 'Could not save profile details. Please try again.' },
      { status: 500 }
    )
  }

  return NextResponse.json({ id: userId, role: input.role })
}
