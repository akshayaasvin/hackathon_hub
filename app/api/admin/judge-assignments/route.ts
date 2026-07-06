import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
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

// Assigns a jury member to a team. Service-role write — judge_assignments
// insert/delete is revoked from the authenticated role (see migration 0012),
// so this route is the only path, same lock-down pattern as teams/submissions.
export async function POST(request: Request) {
  try {
    const adminUser = await requireAdmin()
    if (!adminUser) return apiError('Forbidden — admin access required.', 403)

    let body: any
    try {
      body = await request.json()
    } catch {
      return apiError('Invalid request body — expected JSON.', 400)
    }
    const { hackathonId, teamId, judgeId } = body || {}
    if (!hackathonId || !teamId || !judgeId) {
      return apiError('Invalid request — expected { hackathonId, teamId, judgeId }.', 400)
    }

    let admin
    try {
      admin = createAdminClient()
    } catch (err: any) {
      console.error('[judge-assignments] createAdminClient failed:', err)
      return apiError('Something went wrong. Please try again later.', 500)
    }

    const { data: judge } = await admin.from('users').select('role').eq('id', judgeId).single()
    if (judge?.role !== 'jury') {
      return apiError('Selected user is not a jury member.', 400)
    }

    const { data, error } = await admin
      .from('judge_assignments')
      .insert({ hackathon_id: hackathonId, team_id: teamId, judge_id: judgeId })
      .select()
      .single()

    if (error) {
      console.error('[judge-assignments] insert failed:', error)
      return apiError(
        error.code === '23505' ? 'This jury member is already assigned to that team.' : 'Could not create assignment. Please try again.',
        400
      )
    }

    return apiSuccess({ assignment: data }, 'Jury member assigned.')
  } catch (err: any) {
    console.error('[judge-assignments] unhandled error:', err)
    return apiError('Something went wrong. Please try again.', 500)
  }
}

export async function DELETE(request: Request) {
  try {
    const adminUser = await requireAdmin()
    if (!adminUser) return apiError('Forbidden — admin access required.', 403)

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return apiError('Invalid request — expected ?id=<assignment id>.', 400)

    let admin
    try {
      admin = createAdminClient()
    } catch (err: any) {
      console.error('[judge-assignments] createAdminClient failed:', err)
      return apiError('Something went wrong. Please try again later.', 500)
    }

    const { error } = await admin.from('judge_assignments').delete().eq('id', id)
    if (error) {
      console.error('[judge-assignments] delete failed:', error)
      return apiError('Could not remove assignment. Please try again.', 500)
    }

    return apiSuccess({ deleted: true }, 'Assignment removed.')
  } catch (err: any) {
    console.error('[judge-assignments] unhandled error:', err)
    return apiError('Something went wrong. Please try again.', 500)
  }
}
