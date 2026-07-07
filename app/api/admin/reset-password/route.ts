import crypto from 'crypto'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { apiSuccess, apiError } from '@/lib/apiResponse'

function randomPassword() {
  return crypto.randomBytes(9).toString('base64url')
}

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

// Generates a fresh random password server-side and sets it directly via
// the Auth Admin API (hashed at rest, same as any other password) — never
// stores or reads back a plaintext password. The plaintext only ever exists
// in this one response, for the admin to copy and hand to the account owner.
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
    const userId = body?.userId
    if (!userId || typeof userId !== 'string') {
      return apiError('Invalid request — expected { userId }.', 400)
    }

    let admin
    try {
      admin = createAdminClient()
    } catch (err: any) {
      console.error('[reset-password] createAdminClient failed:', err)
      return apiError('Something went wrong. Please try again later.', 500)
    }

    const { data: targetUser } = await admin.from('users').select('email').eq('id', userId).single()
    if (!targetUser) return apiError('User not found.', 404)

    const newPassword = randomPassword()
    const { error } = await admin.auth.admin.updateUserById(userId, { password: newPassword })
    if (error) {
      console.error('[reset-password] updateUserById failed:', error)
      return apiError('Could not reset password. Please try again.', 500)
    }

    return apiSuccess({ email: targetUser.email, password: newPassword }, 'Password reset.')
  } catch (err: any) {
    console.error('[reset-password] unhandled error:', err)
    return apiError('Something went wrong. Please try again.', 500)
  }
}
