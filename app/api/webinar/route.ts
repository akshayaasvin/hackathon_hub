import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { apiSuccess, apiError } from '@/lib/apiResponse'

export const dynamic = 'force-dynamic'

// Published webinars for the home page, the participant dashboard and /webinar.
// Public, but if the caller is signed in, webinars their account email is already
// registered (paid/free) for are flagged and get the join link. The join link is
// never sent for anyone else.
export async function GET() {
  try {
    const admin = createAdminClient()
    const { data, error } = await admin
      .from('webinars')
      .select('id, title, description, starts_at, fee, currency, join_url')
      .eq('status', 'published')
      .order('starts_at', { ascending: true, nullsFirst: false })
    if (error) throw error
    const webinars = data ?? []

    let registeredIds = new Set<string>()
    if (webinars.length > 0) {
      try {
        const supabase = await createClient()
        const {
          data: { user },
        } = await supabase.auth.getUser()
        if (user?.email) {
          const { data: regs } = await admin
            .from('webinar_registrations')
            .select('webinar_id')
            .eq('email', user.email.toLowerCase())
            .in('status', ['paid', 'free'])
            .in('webinar_id', webinars.map((w) => w.id))
          registeredIds = new Set((regs ?? []).map((r) => r.webinar_id as string))
        }
      } catch (err) {
        console.error('[webinar list] registered lookup failed (non-fatal):', err)
      }
    }

    return apiSuccess(
      {
        webinars: webinars.map((w) => {
          const registered = registeredIds.has(w.id)
          return {
            id: w.id,
            title: w.title,
            description: w.description,
            startsAt: w.starts_at,
            fee: Number(w.fee),
            currency: w.currency || 'INR',
            registered,
            joinUrl: registered ? w.join_url : null,
          }
        }),
      },
      'OK'
    )
  } catch (err) {
    console.error('[webinar list] failed:', err)
    return apiError('Could not load webinars.', 500)
  }
}
