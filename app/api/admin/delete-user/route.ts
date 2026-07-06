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

// Deletes the auth.users row directly — public.users and every profile/
// registration/submission table cascades from it (on delete cascade FKs from
// 0001_init.sql), so this is a genuine hard delete, not a soft-delete flag.
export async function POST(request: Request) {
  try {
    const adminUser = await requireAdmin()
    if (!adminUser) {
      return apiError('Forbidden — admin access required.', 403)
    }

    let body: any
    try {
      body = await request.json()
    } catch {
      return apiError('Invalid request body — expected JSON.', 400)
    }
    const userId = body?.userId
    if (!userId || typeof userId !== 'string') {
      return apiError('Invalid request — expected { userId }.', 400)
    }
    if (userId === adminUser.id) {
      return apiError('You cannot delete your own account.', 400)
    }

    let admin
    try {
      admin = createAdminClient()
    } catch (err: any) {
      console.error('[delete-user] createAdminClient failed:', err)
      return apiError('Something went wrong. Please try again later.', 500)
    }

    const { error } = await admin.auth.admin.deleteUser(userId)
    if (error) {
      console.error('[delete-user] deleteUser failed:', error)
      const isFkViolation = error.message?.toLowerCase().includes('foreign key')
      return apiError(
        isFkViolation
          ? 'Could not delete — this user created a hackathon, approved an application, or leads a team. Reassign that first.'
          : error.message || 'Could not delete user.',
        400
      )
    }

    return apiSuccess({ deleted: true }, 'User deleted.')
  } catch (err: any) {
    console.error('[delete-user] unhandled error:', err)
    return apiError('Something went wrong. Please try again.', 500)
  }
}
