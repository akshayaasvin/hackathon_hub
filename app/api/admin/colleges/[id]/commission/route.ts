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

// colleges.commission_percent is locked to service-role writes (migration
// 0018), so even an admin's own browser session can't update it directly —
// this route is the only path, editable per college from the Ledger page.
export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const adminUser = await requireAdmin()
    if (!adminUser) return apiError('Forbidden — admin access required.', 403)

    let body: any
    try {
      body = await request.json()
    } catch {
      return apiError('Invalid request body — expected JSON.', 400)
    }

    const commissionPercent = Number(body?.commission_percent)
    if (!Number.isFinite(commissionPercent) || commissionPercent < 0 || commissionPercent > 100) {
      return apiError('commission_percent must be a number between 0 and 100.', 400)
    }

    const admin = createAdminClient()
    const { error } = await admin
      .from('colleges')
      .update({ commission_percent: commissionPercent, updated_at: new Date().toISOString() })
      .eq('id', params.id)

    if (error) {
      console.error('[colleges/commission] update failed:', error)
      return apiError('Could not update commission percentage.', 500)
    }

    return apiSuccess({ commission_percent: commissionPercent }, 'Commission percentage updated.')
  } catch (err: any) {
    console.error('[colleges/commission] unhandled error:', err)
    return apiError('Something went wrong. Please try again.', 500)
  }
}
