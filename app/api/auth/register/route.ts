import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { registerSchema, type CollegeRegisterInput, type JuryRegisterInput } from '@/lib/validation'
import { apiSuccess, apiError } from '@/lib/apiResponse'
import { sendEmail, applicationReceivedEmailHtml } from '@/lib/email'

// Submits (or resubmits) a college/jury application to its staging table.
// No auth.users account is created here — that only happens once an admin
// approves the application (see app/api/admin/approvals/route.ts). This
// avoids burning Supabase's auth email rate limit on unapproved sign-ups
// and means a rejected applicant never had a live account to begin with.
async function upsertApplication(
  admin: any,
  table: 'college_applications' | 'jury_applications',
  emailColumn: 'official_email' | 'email',
  email: string,
  fields: Record<string, unknown>
): Promise<{ error: string | null }> {
  const { error: insertError } = await admin.from(table).insert({ ...fields, status: 'pending' })

  if (!insertError) return { error: null }

  const isDuplicate = insertError.code === '23505' || insertError.message.includes('duplicate')
  if (!isDuplicate) {
    console.error(`[register] ${table} insert failed:`, insertError)
    return { error: 'Could not submit your application. Please try again.' }
  }

  const { data: existing } = await admin.from(table).select('*').eq(emailColumn, email).single()
  if (!existing) {
    return { error: 'Could not submit your application. Please try again.' }
  }

  if (existing.status === 'pending') {
    return { error: 'You already have an application under review for this email.' }
  }
  if (existing.status === 'approved') {
    return { error: 'An account with this email has already been approved. Try logging in instead.' }
  }

  // status was 'rejected' or 'changes_requested' — resubmission overwrites it.
  const { error: updateError } = await admin
    .from(table)
    .update({
      ...fields,
      status: 'pending',
      admin_notes: null,
      reviewed_by: null,
      reviewed_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq(emailColumn, email)

  if (updateError) {
    console.error(`[register] ${table} resubmit failed:`, updateError)
    return { error: 'Could not submit your application. Please try again.' }
  }
  return { error: null }
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

    let admin
    try {
      admin = createAdminClient()
    } catch (err: any) {
      console.error('[register] createAdminClient failed:', err)
      return apiError('Something went wrong. Please try again later.', 500)
    }

    // ── Participant: the only role that gets a real Supabase Auth account
    // immediately (email confirmation drives the auto-activation trigger). ──
    if (input.role === 'participant') {
      const supabase = await createClient()
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: input.email,
        password: input.password,
        options: { emailRedirectTo: `${siteUrl}/login?confirmed=1` },
      })

      if (signUpError || !signUpData.user) {
        return apiError(
          signUpError?.message.includes('already registered')
            ? 'An account with this email already exists.'
            : signUpError?.message || 'Registration failed',
          400
        )
      }

      const userId = signUpData.user.id

      // Upsert, not insert: a database trigger may have already created a
      // placeholder row (role=participant, status=pending) the instant
      // auth.users got this id, before this code ever ran. `status` is
      // deliberately omitted here — it starts (and stays) 'pending' until
      // the participant confirms their email, at which point the
      // `handle_auth_email_confirmed` trigger flips it to 'active'.
      const { error: usersError } = await admin.from('users').upsert(
        {
          id: userId,
          email: input.email,
          full_name: input.full_name,
          role: 'participant',
        },
        { onConflict: 'id' }
      )

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

      const { error: profileError } = await admin.from('participant_profiles').insert({
        user_id: userId,
        college_name: input.college_name,
        passout_year: input.passout_year,
        degree: input.degree,
        domain: input.domain,
        experience_level: input.experience_level,
        contact_number: input.contact_number,
        address: input.address,
        date_of_birth: input.date_of_birth,
      })

      if (profileError) {
        console.error('[register] participant_profiles insert failed:', profileError)
        await admin.from('users').delete().eq('id', userId)
        try {
          await admin.auth.admin.deleteUser(userId)
        } catch {}
        return apiError('Could not save your profile details. Please try again.', 500)
      }

      return apiSuccess({ role: 'participant', status: 'pending' }, 'Registration successful.')
    }

    // ── College / Jury: staging-table application, no auth account yet. ──
    if (input.role === 'college') {
      const collegeInput = input as CollegeRegisterInput
      const { error } = await upsertApplication(
        admin,
        'college_applications',
        'official_email',
        collegeInput.official_email,
        {
          college_name: collegeInput.college_name,
          representative_name: collegeInput.representative_name,
          position_in_college: collegeInput.position_in_college,
          official_email: collegeInput.official_email,
          personal_email: collegeInput.personal_email || null,
          contact_number: collegeInput.contact_number,
          department: collegeInput.department || null,
          college_address: collegeInput.college_address,
        }
      )
      if (error) return apiError(error, 400)

      await sendEmail({
        to: collegeInput.official_email,
        subject: 'HackathonHub application received',
        html: applicationReceivedEmailHtml({ fullName: collegeInput.representative_name }),
      })

      return apiSuccess({ role: 'college', status: 'pending' }, 'Application submitted.')
    }

    const juryInput = input as JuryRegisterInput
    const { error } = await upsertApplication(admin, 'jury_applications', 'email', juryInput.email, {
      full_name: juryInput.full_name,
      contact_number: juryInput.contact_number,
      email: juryInput.email,
      official_email: juryInput.official_email || null,
      organization_name: juryInput.organization_name || null,
      portfolio_url: juryInput.portfolio_url || null,
      occupation: juryInput.occupation,
      experience_years: juryInput.experience_years ?? null,
      location: juryInput.location,
    })
    if (error) return apiError(error, 400)

    await sendEmail({
      to: juryInput.email,
      subject: 'HackathonHub application received',
      html: applicationReceivedEmailHtml({ fullName: juryInput.full_name }),
    })

    return apiSuccess({ role: 'jury', status: 'pending' }, 'Application submitted.')
  } catch (err: any) {
    console.error('[register] unhandled error:', err)
    return apiError('Something went wrong. Please try again.', 500)
  }
}
