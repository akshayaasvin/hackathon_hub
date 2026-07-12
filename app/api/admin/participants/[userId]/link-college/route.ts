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

// Manually links a participant_profiles row (that registered via the
// free-text "my college isn't listed" fallback, so college_id is null) to
// a real colleges row — the "flagged for admin to link later" half of the
// 0021 migration. college_name stays untouched; every RLS policy and the
// leaderboard still match on it, this only fills in the audit FK.
export async function POST(request: Request, { params }: { params: { userId: string } }) {
  try {
    const adminUser = await requireAdmin()
    if (!adminUser) return apiError('Forbidden — admin access required.', 403)

    let body: any
    try {
      body = await request.json()
    } catch {
      return apiError('Invalid request body — expected JSON.', 400)
    }
    const collegeId = body?.collegeId
    if (typeof collegeId !== 'string' || !collegeId) {
      return apiError('Missing collegeId.', 400)
    }

    const admin = createAdminClient()

    const { data: college } = await admin.from('colleges').select('id').eq('id', collegeId).single()
    if (!college) return apiError('College not found.', 404)

    const { error } = await admin.from('participant_profiles').update({ college_id: collegeId }).eq('user_id', params.userId)
    if (error) {
      console.error('[link-college] update failed:', error)
      return apiError('Could not link student to college. Please try again.', 500)
    }

    return apiSuccess({ linked: true }, 'Student linked to college.')
  } catch (err: any) {
    console.error('[link-college] unhandled error:', err)
    return apiError('Something went wrong. Please try again.', 500)
  }
}
