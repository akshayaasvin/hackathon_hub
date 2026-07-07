import crypto from 'crypto'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { adminCreateSchema } from '@/lib/validation'
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

// Lets an admin directly create an already-active college/jury account
// (bypassing self-serve registration + approval). Never calls client-side
// signUp — that would swap the caller's own session for the new user's.
export async function POST(request: Request) {
  try {
    const adminUser = await requireAdmin()
    if (!adminUser) {
      return apiError('Forbidden — admin access required.', 403)
    }

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return apiError('Invalid request body — expected JSON.', 400)
    }

    const parsed = adminCreateSchema.safeParse(body)
    if (!parsed.success) {
      return apiError(parsed.error.issues[0]?.message || 'Invalid input', 400)
    }
    const input = parsed.data

    const email = input.role === 'college' ? input.official_email : input.email
    const fullName = input.role === 'college' ? input.representative_name : input.full_name

    let admin
    try {
      admin = createAdminClient()
    } catch (err: any) {
      console.error('[create-account] createAdminClient failed:', err)
      return apiError('Something went wrong. Please try again later.', 500)
    }

    const generatedPassword = randomPassword()
    const { data: createData, error: createError } = await admin.auth.admin.createUser({
      email,
      password: generatedPassword,
      email_confirm: true,
    })

    if (createError || !createData.user) {
      return apiError(createError?.message || 'Could not create account', 400)
    }

    const userId = createData.user.id

    // Upsert, not insert: the on_auth_user_created trigger may have already
    // created a placeholder row (role=participant, status=pending) the
    // instant createUser() ran, before this code got here.
    const { error: usersError } = await admin.from('users').upsert(
      {
        id: userId,
        email,
        full_name: fullName,
        role: input.role,
        status: 'active',
      },
      { onConflict: 'id' }
    )

    if (usersError) {
      console.error('[create-account] users insert failed:', usersError)
      await admin.auth.admin.deleteUser(userId)
      return apiError('Could not create account. Please try again.', 500)
    }

    let profileError = null
    if (input.role === 'college') {
      const { error } = await admin.from('college_profiles').insert({
        user_id: userId,
        college_name: input.college_name,
        representative_name: input.representative_name,
        position_in_college: input.position_in_college,
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
        location: input.location,
      })
      profileError = error
    }

    if (profileError) {
      console.error('[create-account] profile insert failed:', profileError)
      await admin.from('users').delete().eq('id', userId)
      await admin.auth.admin.deleteUser(userId)
      return apiError('Could not save profile details. Please try again.', 500)
    }

    return apiSuccess({ id: userId, role: input.role, email, password: generatedPassword }, 'Account created.')
  } catch (err: any) {
    console.error('[create-account] unhandled error:', err)
    return apiError('Something went wrong. Please try again.', 500)
  }
}
