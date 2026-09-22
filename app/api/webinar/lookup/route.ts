import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { normalizeIndianMobile } from '@/lib/phone'
import { apiSuccess, apiError } from '@/lib/apiResponse'

// "Forgot to copy your meeting link?" — since webinar confirmations are never emailed,
// this is how a registrant recovers it from a different browser/device: they must supply
// the SAME email AND mobile number they registered with. Matching on both (not email
// alone) keeps this from being a plain "look up anyone's meeting link by email" oracle,
// and only CONFIRMED (paid/free) registrations are returned — never a payment_pending one
// (that must go through /api/webinar/register, which re-validates the fee/order).
const bodySchema = z.object({
  email: z.email('Enter a valid email address').max(254),
  phone: z.string().trim().min(7, 'Enter a valid mobile number').max(20),
})

export async function POST(request: Request) {
  try {
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return apiError('Invalid request body — expected JSON.', 400)
    }
    const parsed = bodySchema.safeParse(body)
    if (!parsed.success) return apiError(parsed.error.issues[0]?.message || 'Invalid input', 400)

    const phone = normalizeIndianMobile(parsed.data.phone)
    if (!phone) return apiError('Enter a valid 10-digit mobile number.', 400)
    const email = parsed.data.email.trim().toLowerCase()

    const admin = createAdminClient()
    const { data, error } = await admin
      .from('webinar_registrations')
      .select('id, full_name, access_token, amount, payment_id, webinar:webinars(title, starts_at, join_url)')
      .eq('email', email)
      .eq('phone', phone)
      .in('status', ['paid', 'free'])
      .order('created_at', { ascending: false })
      .limit(10)
    if (error) throw error

    const registrations = (data ?? []).map((r: any) => {
      const webinar = Array.isArray(r.webinar) ? r.webinar[0] : r.webinar
      return {
        registrationId: r.id as string,
        accessToken: r.access_token as string,
        fullName: r.full_name as string,
        amount: r.amount != null ? Number(r.amount) : null,
        paymentId: r.payment_id as string | null,
        webinar: webinar ? { title: webinar.title as string, startsAt: webinar.starts_at as string | null, joinUrl: webinar.join_url as string | null } : null,
      }
    })

    // Same message whether nothing matched or the email exists with a different phone —
    // doesn't confirm or deny which part was wrong.
    if (registrations.length === 0) {
      return apiError('No confirmed registration found for that email and mobile number.', 404)
    }

    return apiSuccess({ registrations }, 'OK')
  } catch (err: any) {
    console.error('[webinar/lookup] unhandled error:', err)
    return apiError('Something went wrong. Please try again.', 500)
  }
}
