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

// Columns that reference public.users(id) WITHOUT on delete cascade — these
// are informational/audit references (who created/approved/led something),
// not ownership, so clearing them to null before deleting the user is safe
// and preserves the referencing row. Every other user_id/judge_id/etc column
// in the schema already cascades, so this list is deliberately exhaustive:
// leaving any of these out is exactly what produces "foreign key constraint"
// (or GoTrue's generic "Database error deleting user") failures.
const NULLABLE_USER_REFERENCES: Array<{ table: string; column: string }> = [
  { table: 'hackathons', column: 'created_by' },
  { table: 'teams', column: 'team_lead_id' },
  { table: 'college_profiles', column: 'approved_by' },
  { table: 'jury_profiles', column: 'approved_by' },
  { table: 'college_applications', column: 'reviewed_by' },
  { table: 'college_applications', column: 'created_user_id' },
  { table: 'jury_applications', column: 'reviewed_by' },
  { table: 'jury_applications', column: 'created_user_id' },
  { table: 'registrations', column: 'reviewed_by' },
  { table: 'announcements', column: 'created_by' },
]

// Deletes the auth.users row directly — public.users and every profile/
// registration/submission table cascades from it (on delete cascade FKs from
// 0001_init.sql), so this is a genuine hard delete, not a soft-delete flag.
// Non-cascading references (above) are cleared first so the delete never
// hits a foreign-key violation in the first place.
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

    for (const { table, column } of NULLABLE_USER_REFERENCES) {
      const { error: clearError } = await admin.from(table).update({ [column]: null }).eq(column, userId)
      if (clearError) {
        console.error(`[delete-user] failed clearing ${table}.${column}:`, clearError)
        return apiError('Could not delete user. Please try again.', 500)
      }
    }

    const { error } = await admin.auth.admin.deleteUser(userId)
    if (error) {
      console.error('[delete-user] deleteUser failed:', error)
      const isFkViolation = error.message?.toLowerCase().includes('foreign key')
      return apiError(
        isFkViolation
          ? 'Could not delete — this user is still referenced elsewhere. Please try again or contact support.'
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
