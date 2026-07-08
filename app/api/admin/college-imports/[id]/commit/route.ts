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

// Phase 2 of the College Ledger import (item 4): only 'matched' rows whose
// registration hasn't already progressed past payment (i.e. not already
// approved via Razorpay or a prior import) get marked paid — never the
// whole college, only the exact students in this file.
const PAYABLE_STATUSES = ['registered', 'payment_pending', 'rejected']

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const adminUser = await requireAdmin()
    if (!adminUser) return apiError('Forbidden — admin access required.', 403)

    const admin = createAdminClient()

    const { data: importRow, error: fetchError } = await admin
      .from('college_payment_imports')
      .select('*')
      .eq('id', params.id)
      .single()

    if (fetchError || !importRow) return apiError('Import batch not found.', 404)
    if (importRow.status !== 'previewing') {
      return apiError(`This import was already ${importRow.status}.`, 400)
    }

    const { data: rows } = await admin
      .from('college_payment_import_rows')
      .select('*')
      .eq('import_id', params.id)
      .eq('match_status', 'matched')

    const now = new Date().toISOString()

    for (const row of rows || []) {
      if (!row.registration_id) continue
      const { data: registration } = await admin
        .from('registrations')
        .select('status')
        .eq('id', row.registration_id)
        .single()
      if (!registration || !PAYABLE_STATUSES.includes(registration.status)) continue

      await admin
        .from('registrations')
        .update({
          status: 'approved',
          payment_method: 'offline_import',
          payment_amount: row.amount,
          payment_reference: row.payment_reference,
          reviewed_by: adminUser.id,
          reviewed_at: now,
        })
        .eq('id', row.registration_id)
    }

    await admin
      .from('college_payment_imports')
      .update({ status: 'committed', committed_at: now, committed_by: adminUser.id })
      .eq('id', params.id)

    // Fresh collected money for this college — surface it for reconciliation
    // again even if a previous round was already marked settled.
    await admin.from('colleges').update({ settlement_status: 'pending' }).eq('id', importRow.college_id)

    return apiSuccess({ status: 'committed' }, 'Import committed — matched students marked paid.')
  } catch (err: any) {
    console.error('[college-imports/commit] unhandled error:', err)
    return apiError('Something went wrong. Please try again.', 500)
  }
}
