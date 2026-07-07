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

// Soft delete only — sets deleted_at so it disappears from every normal
// query (see migration 0013) while teams/submissions/results/judge_assignments
// stay intact for audit history.
export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const adminUser = await requireAdmin()
    if (!adminUser) return apiError('Forbidden — admin access required.', 403)

    let admin
    try {
      admin = createAdminClient()
    } catch (err: any) {
      console.error('[hackathons/delete] createAdminClient failed:', err)
      return apiError('Something went wrong. Please try again later.', 500)
    }

    const { error } = await admin
      .from('hackathons')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', params.id)

    if (error) {
      console.error('[hackathons/delete] update failed:', error)
      return apiError('Could not delete hackathon. Please try again.', 500)
    }

    return apiSuccess({ deleted: true }, 'Hackathon deleted.')
  } catch (err: any) {
    console.error('[hackathons/delete] unhandled error:', err)
    return apiError('Something went wrong. Please try again.', 500)
  }
}
