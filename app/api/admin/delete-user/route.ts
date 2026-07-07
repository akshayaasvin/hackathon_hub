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

// Columns that reference public.users(id) — audit/pointer references (who
// created/approved/led something), not ownership. Migration
// 0014_fix_user_delete_fk_cascade.sql gives every one of these an explicit
// `on delete set null` at the database level, which is now the real fix —
// Postgres clears them automatically. This list is kept as a best-effort,
// non-fatal pre-clear: harmless once 0014 is applied, and still useful as a
// safety net if that migration hasn't been run yet on a given environment.
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

    // Best-effort pre-clear (see comment above) — a failure here doesn't
    // abort the delete, since 0014's `on delete set null` handles it anyway.
    for (const { table, column } of NULLABLE_USER_REFERENCES) {
      const { error: clearError } = await admin.from(table).update({ [column]: null }).eq(column, userId)
      if (clearError) {
        console.warn(`[delete-user] pre-clear ${table}.${column} failed (non-fatal):`, clearError.message)
      }
    }

    const { error } = await admin.auth.admin.deleteUser(userId)
    if (error) {
      console.error('[delete-user] deleteUser failed:', error)
      const isFkViolation = (error as any).code === '23503' || error.message?.toLowerCase().includes('foreign key')
      return apiError(
        isFkViolation
          ? 'This user still has related records that could not be automatically removed. Please contact support.'
          : error.message || 'Could not delete user. Please try again.',
        400
      )
    }

    return apiSuccess({ deleted: true }, 'User deleted.')
  } catch (err: any) {
    console.error('[delete-user] unhandled error:', err)
    return apiError('Something went wrong. Please try again.', 500)
  }
}
