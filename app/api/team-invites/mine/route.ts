import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { apiSuccess, apiError } from '@/lib/apiResponse'

export const dynamic = 'force-dynamic'

// The current user's own PENDING invites — used by the participant Dashboard (across every
// hackathon) and the Team step on a specific hackathon page (?hackathonId= narrows to just
// that one). Service-role because it joins in the team/hackathon/inviter names, which the
// invitee's own RLS has no reason to be able to read for a team they're not on yet.
export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return apiError('Not authenticated.', 401)

    const url = new URL(request.url)
    const hackathonId = url.searchParams.get('hackathonId')

    const admin = createAdminClient()
    let query = admin
      .from('team_invites')
      .select('id, created_at, invited_by, team:teams(id, team_name), hackathon:hackathons(id, name)')
      .eq('invited_user_id', user.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
    if (hackathonId) query = query.eq('hackathon_id', hackathonId)
    const { data, error } = await query
    if (error) throw error

    const invites = data ?? []
    const inviterIds = Array.from(new Set(invites.map((i: any) => i.invited_by).filter(Boolean)))
    let inviters: any[] = []
    if (inviterIds.length > 0) {
      const { data: inviterRows, error: inviterError } = await admin.from('users').select('id, full_name, email').in('id', inviterIds)
      if (inviterError) throw inviterError
      inviters = inviterRows ?? []
    }
    const withInviter = invites.map((i: any) => ({ ...i, inviter: inviters.find((u) => u.id === i.invited_by) ?? null }))

    return apiSuccess({ invites: withInviter })
  } catch (err) {
    console.error('[team-invites/mine] failed:', err)
    return apiError('Could not load your invites.', 500)
  }
}
