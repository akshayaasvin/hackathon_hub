import crypto from 'crypto'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { registerSchema } from '@/lib/validation'
import { apiSuccess, apiError } from '@/lib/apiResponse'

function randomPassword() {
  return crypto.randomBytes(18).toString('base64url')
}

export async function POST(request: Request) {
  try {
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return apiError('Invalid request body — expected JSON.', 400)
    }

    const parsed = registerSchema.safeParse(body)
    if (!parsed.success) {
      return apiError(parsed.error.issues[0]?.message || 'Invalid input', 400)
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

    let admin
    try {
      admin = createAdminClient()
    } catch (err: any) {
      console.error('[register] createAdminClient failed:', err)
      return apiError('Something went wrong. Please try again later.', 500)
    }

    let userId: string
    if (input.role === 'participant') {
      // Participants need a real Supabase confirmation email — it drives the
      // auto-activation trigger on auth.users.email_confirmed_at.
      const supabase = await createClient()
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
      })
      if (signUpError || !signUpData.user) {
        return apiError(
          signUpError?.message.includes('already registered')
            ? 'An account with this email already exists.'
            : signUpError?.message || 'Registration failed',
          400
        )
      }
      userId = signUpData.user.id
    } else {
      // College/jury accounts can't log in until admin approval regardless
      // (see middleware's pending/rejected gate), so there's nothing for a
      // confirmation email to do here. Using admin.createUser instead of
      // signUp skips Supabase's own auth email entirely — signUp was
      // burning through the project's email rate limit on every attempt,
      // which then broke registration for every role, not just this one.
      const { data: createData, error: createError } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      })
      if (createError || !createData.user) {
        return apiError(
          createError?.message.includes('already registered') ||
            createError?.message.includes('already been registered')
            ? 'An account with this email already exists.'
            : 'Registration failed. Please try again.',
          400
        )
      }
      userId = createData.user.id
    }

    const status = input.role === 'participant' ? 'active' : 'pending'

    const { error: usersError } = await admin.from('users').insert({
      id: userId,
      email,
      full_name: fullName,
      role: input.role,
      status,
    })

    if (usersError) {
      console.error('[register] users insert failed:', usersError)
      try {
        await admin.auth.admin.deleteUser(userId)
      } catch {}
      return apiError(
        usersError.message.includes('duplicate') || usersError.code === '23505'
          ? 'An account with this email already exists.'
          : 'Could not create account. Please try again.',
        500
      )
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
      console.error('[register] profile insert failed:', profileError)
      await admin.from('users').delete().eq('id', userId)
      try {
        await admin.auth.admin.deleteUser(userId)
      } catch {}
      return apiError('Could not save your profile details. Please try again.', 500)
    }

    return apiSuccess({ role: input.role, status }, 'Registration successful.')
  } catch (err: any) {
    console.error('[register] unhandled error:', err)
    return apiError('Something went wrong. Please try again.', 500)
  }
}
