import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail } from '@/lib/email'
import { apiSuccess, apiError } from '@/lib/apiResponse'

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

// payment_submitted -> approved | rejected. Admin-only.
export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const adminUser = await requireAdmin()
    if (!adminUser) return apiError('Forbidden — admin access required.', 403)

    let body: any
    try {
      body = await request.json()
    } catch {
      return apiError('Invalid request body — expected JSON.', 400)
    }
    const action = body?.action
    if (action !== 'approve' && action !== 'reject') {
      return apiError('Invalid request — expected { action: "approve" | "reject" }.', 400)
    }

    let admin
    try {
      admin = createAdminClient()
    } catch (err: any) {
      console.error('[registrations/approve] createAdminClient failed:', err)
      return apiError('Something went wrong. Please try again later.', 500)
    }

    const { data: registration, error: fetchError } = await admin
      .from('registrations')
      .select('id, user_id, status')
      .eq('id', params.id)
      .single()

    if (fetchError || !registration) return apiError('Registration not found.', 404)
    if (registration.status !== 'payment_submitted') {
      return apiError(`Cannot ${action} from status "${registration.status}".`, 400)
    }

    const newStatus = action === 'approve' ? 'approved' : 'rejected'
    const { error: updateError } = await admin
      .from('registrations')
      .update({ status: newStatus, reviewed_by: adminUser.id, reviewed_at: new Date().toISOString() })
      .eq('id', params.id)

    if (updateError) {
      console.error('[registrations/approve] update failed:', updateError)
      return apiError('Could not update registration. Please try again.', 500)
    }

    const { data: participant } = await admin.from('users').select('email, full_name').eq('id', registration.user_id).single()
    if (participant?.email) {
      await sendEmail({
        to: participant.email,
        subject: newStatus === 'approved' ? 'Your hackathon registration is approved' : 'Your hackathon payment was rejected',
        html: `<p>Hi ${participant.full_name || ''},</p><p>${
          newStatus === 'approved'
            ? 'Your payment has been verified and your registration is approved. You can now create your team.'
            : 'Your payment could not be verified. Please retry payment from your dashboard.'
        }</p>`,
      })
    }

    return apiSuccess({ status: newStatus }, `Registration ${newStatus}.`)
  } catch (err: any) {
    console.error('[registrations/approve] unhandled error:', err)
    return apiError('Something went wrong. Please try again.', 500)
  }
}
