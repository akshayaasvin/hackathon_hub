import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { apiSuccess, apiError } from '@/lib/apiResponse'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Optional live availability check (Phase 2, section 2) for the Create Team form — debounced
// client-side. Requires a session (not public) but does the actual lookup with the
// service-role client, same reasoning as the invite route: a participant's own RLS has no
// reason to be able to see other teams' names directly.
export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return apiError('Not authenticated.', 401)

    const url = new URL(request.url)
    const hackathonId = url.searchParams.get('hackathonId') || ''
    const name = (url.searchParams.get('name') || '').trim()
    if (!UUID_RE.test(hackathonId) || !name) return apiError('Invalid request.', 400)

    const admin = createAdminClient()
    const { data: existing, error } = await admin
      .from('teams')
      .select('id')
      .eq('hackathon_id', hackathonId)
      .ilike('team_name', name)
      .maybeSingle()
    if (error) throw error

    return apiSuccess({ available: !existing })
  } catch (err) {
    console.error('[teams/check-name] failed:', err)
    return apiError('Could not check name availability.', 500)
  }
}
