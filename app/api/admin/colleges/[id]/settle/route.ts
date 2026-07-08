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

// Records a "Mark Settled" action for the College Ledger (item 4) — manual
// reconciliation only, no Razorpay Route/automatic splitting. Logs an
// audit row in college_settlements in addition to the latest-snapshot
// columns on `colleges` itself.
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

    const amount = Number(body?.amount)
    if (!Number.isFinite(amount) || amount < 0) {
      return apiError('amount must be a non-negative number.', 400)
    }
    const notes = typeof body?.notes === 'string' ? body.notes.trim() || null : null

    const admin = createAdminClient()
    const now = new Date().toISOString()

    const { error: settlementError } = await admin.from('college_settlements').insert({
      college_id: params.id,
      amount,
      settled_by: adminUser.id,
      notes,
    })
    if (settlementError) {
      console.error('[colleges/settle] settlement insert failed:', settlementError)
      return apiError('Could not record the settlement.', 500)
    }

    const { error: updateError } = await admin
      .from('colleges')
      .update({
        settlement_status: 'settled',
        settled_at: now,
        settled_by: adminUser.id,
        last_settled_amount: amount,
        updated_at: now,
      })
      .eq('id', params.id)

    if (updateError) {
      console.error('[colleges/settle] college update failed:', updateError)
      return apiError('Could not update settlement status.', 500)
    }

    return apiSuccess({ settlement_status: 'settled' }, 'Marked as settled.')
  } catch (err: any) {
    console.error('[colleges/settle] unhandled error:', err)
    return apiError('Something went wrong. Please try again.', 500)
  }
}
