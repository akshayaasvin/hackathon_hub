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

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const adminUser = await requireAdmin()
    if (!adminUser) return apiError('Forbidden — admin access required.', 403)

    let admin
    try {
      admin = createAdminClient()
    } catch (err: any) {
      console.error('[announcements] createAdminClient failed:', err)
      return apiError('Something went wrong. Please try again later.', 500)
    }

    const { error } = await admin.from('announcements').delete().eq('id', params.id)
    if (error) {
      console.error('[announcements] delete failed:', error)
      return apiError('Could not delete announcement. Please try again.', 500)
    }

    return apiSuccess({ deleted: true }, 'Announcement deleted.')
  } catch (err: any) {
    console.error('[announcements] unhandled error:', err)
    return apiError('Something went wrong. Please try again.', 500)
  }
}
