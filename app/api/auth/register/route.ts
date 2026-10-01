import { createAdminClient } from '@/lib/supabase/admin'
import { registerSchema, type CollegeRegisterInput, type JuryRegisterInput } from '@/lib/validation'
import { apiSuccess, apiError } from '@/lib/apiResponse'
import { sendEmail, applicationReceivedEmailHtml, welcomeParticipantEmailHtml } from '@/lib/email'

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

    // ── Participant: created already-confirmed via the service-role admin API — no
    // Supabase confirmation email goes out, and no "pending" email-confirmation state ever
    // exists for this role. The client signs the participant in immediately after this
    // succeeds (see ParticipantRegisterForm), so there is no login screen in between. ──
    if (input.role === 'participant') {
      const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin).replace(/\/+$/, '')

      // createUser (not signUp) — this is the service-role admin API, not a session-scoped
      // client, and email_confirm: true marks the account confirmed on creation rather than
      // relying on the on_auth_email_confirmed trigger (which only ever fires on an UPDATE
      // of email_confirmed_at, never on INSERT, so it would never fire here).
      const { data: createData, error: createError } = await admin.auth.admin.createUser({
        email: input.email,
        password: input.password,
        email_confirm: true,
        user_metadata: {
          full_name: input.full_name,
          college_name: input.college_name,
          passout_year: input.passout_year,
          degree: input.degree,
          domain: input.domain,
          contact_number: input.contact_number,
        },
      })

      if (createError || !createData.user) {
        const alreadyExists = createError?.code === 'email_exists' || /already\s*regist/i.test(createError?.message || '')
        return apiError(
          alreadyExists ? 'Email already registered — please log in.' : createError?.message || 'Registration failed. Please try again.',
          400
        )
      }

      const userId = createData.user.id

      // Upsert, not insert: a database trigger may have already created a placeholder row
      // (role=participant, status=pending) the instant createUser() ran, before this code
      // got here. status is set to 'active' synchronously in this same request — there is
      // no trigger-driven lag to wait out, unlike the old email-confirmation flow.
      const { error: usersError } = await admin.from('users').upsert(
        {
          id: userId,
          email: input.email,
          full_name: input.full_name,
          role: 'participant',
          status: 'active',
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
            ? 'Email already registered — please log in.'
            : 'Could not create account. Please try again.',
          500
        )
      }

      const { error: profileError } = await admin.from('participant_profiles').upsert(
        {
          user_id: userId,
          college_name: input.college_name,
          college_id: input.college_id || null,
          passout_year: input.passout_year,
          degree: input.degree,
          domain: input.domain,
          experience_level: input.experience_level,
          contact_number: input.contact_number,
          address: input.address,
          date_of_birth: input.date_of_birth,
        },
        { onConflict: 'user_id' }
      )

      if (profileError) {
        console.error('[register] participant_profiles upsert failed:', profileError)
        // Only clean up the auth account when NOTHING was ever saved for it — a brand-new
        // signup whose very first write failed. If a profile already existed (this was a
        // resubmission), leave the account alone: it's still valid, just tell them what to do.
        const { data: existingProfile } = await admin.from('participant_profiles').select('user_id').eq('user_id', userId).maybeSingle()
        if (!existingProfile) {
          await admin.from('users').delete().eq('id', userId)
          try {
            await admin.auth.admin.deleteUser(userId)
          } catch {}
        }
        return apiError('Could not save your profile details. Please try again in a moment.', 500)
      }

      // The password only ever exists in this request's closure (parsed from the request
      // body above) — it is never written to any table, logged, or echoed back to the
      // client below. If the email fails to send, registration still succeeds; the failure
      // is logged without the password.
      try {
        await sendEmail({
          to: input.email,
          subject: 'Welcome to HackathonHub',
          html: welcomeParticipantEmailHtml({
            fullName: input.full_name,
            email: input.email,
            password: input.password,
            degree: input.degree,
            domain: input.domain,
            passoutYear: input.passout_year,
            contactNumber: input.contact_number,
            loginUrl: `${siteUrl}/login`,
          }),
        })
      } catch (emailErr) {
        console.error('[register] welcome email failed to send for user', userId, emailErr)
      }

      return apiSuccess({ role: 'participant', status: 'active', email: input.email }, 'Registration successful.')
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
