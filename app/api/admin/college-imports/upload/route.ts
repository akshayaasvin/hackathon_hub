import Papa from 'papaparse'
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

function normalizeHeader(header: string): string {
  return header.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_')
}

// Phase 1 of the College Ledger import (item 4): parse the CSV and match
// each row to a registration by email — nothing is written to
// `registrations` here, only a 'previewing' batch + its rows, so the admin
// can review matched vs unmatched before anything is marked paid.
export async function POST(request: Request) {
  try {
    const adminUser = await requireAdmin()
    if (!adminUser) return apiError('Forbidden — admin access required.', 403)

    const form = await request.formData()
    const file = form.get('file')
    const collegeId = form.get('college_id')
    const hackathonId = form.get('hackathon_id')

    if (!(file instanceof File)) return apiError('Missing file upload.', 400)
    if (typeof collegeId !== 'string' || !collegeId) return apiError('Missing college_id.', 400)
    if (typeof hackathonId !== 'string' || !hackathonId) return apiError('Missing hackathon_id.', 400)
    if (!file.name.toLowerCase().endsWith('.csv')) {
      return apiError('Only .csv files are supported — export your spreadsheet as CSV first.', 400)
    }

    const text = await file.text()
    const parsed = Papa.parse<Record<string, string>>(text, {
      header: true,
      skipEmptyLines: true,
      transformHeader: normalizeHeader,
    })

    // Row-level issues surfaced to the admin instead of silently vanishing
    // or aborting the whole file. Row numbers are 1-indexed + header row,
    // so they match what the admin sees if they open the CSV in a
    // spreadsheet app.
    const issues: { row: number; reason: string }[] = []

    // A single ragged row (wrong field count) used to fail parsed.errors
    // and reject the *entire* file with a generic message — a 500-row
    // upload with one bad line lost every good row. Now only that
    // specific row is skipped; everything else still gets processed.
    const errorRowMessages = new Map<number, string>()
    for (const e of parsed.errors) {
      if (e.row != null) errorRowMessages.set(e.row, e.message || 'Could not parse this row.')
    }

    const candidateRows = parsed.data
      .map((raw, idx) => {
        if (errorRowMessages.has(idx)) {
          issues.push({ row: idx + 2, reason: errorRowMessages.get(idx)! })
          return null
        }
        const email = (raw.email || raw.email_address || '').trim().toLowerCase()
        if (!email) {
          // Previously filtered out with zero trace — not even counted
          // as "unmatched" — so a blank-email row just vanished with no
          // way for the admin to know it existed.
          issues.push({ row: idx + 2, reason: 'Missing email — row skipped.' })
          return null
        }
        const amountRaw = raw.amount ?? raw.payment_amount
        const amount = amountRaw !== undefined && amountRaw !== '' ? Number(amountRaw) : null
        return {
          rowIndex: idx,
          email,
          student_name: (raw.name || raw.student_name || '').trim() || null,
          department: (raw.department || '').trim() || null,
          payment_reference: (raw.payment_reference || raw.reference || raw.transaction_id || '').trim() || null,
          amount: amount !== null && Number.isFinite(amount) ? amount : null,
        }
      })
      .filter((r): r is Exclude<typeof r, null> => r !== null)

    // Duplicate emails within this same file: keep only the last
    // occurrence. Previously both rows were inserted as separately
    // "matched", both pointing at the same registration — committing
    // would update that registration twice, and whichever processed last
    // silently won (a different amount/reference with zero warning).
    const lastRowIndexForEmail = new Map<string, number>()
    for (const row of candidateRows) lastRowIndexForEmail.set(row.email, row.rowIndex)

    const rows = candidateRows.filter((row) => {
      const isLastOccurrence = lastRowIndexForEmail.get(row.email) === row.rowIndex
      if (!isLastOccurrence) {
        issues.push({ row: row.rowIndex + 2, reason: `Duplicate email "${row.email}" — a later row for the same email was used instead.` })
      }
      return isLastOccurrence
    })

    if (rows.length === 0) {
      return apiError('No usable rows found — make sure the CSV has an "email" column and at least one valid row.', 400)
    }

    const admin = createAdminClient()

    const emails = rows.map((r) => r.email)
    const { data: users } = await admin.from('users').select('id, email').in('email', emails)
    const userIdByEmail = new Map((users || []).map((u) => [u.email.toLowerCase(), u.id]))

    const userIds = Array.from(userIdByEmail.values())
    const { data: registrations } = userIds.length
      ? await admin.from('registrations').select('id, user_id').eq('hackathon_id', hackathonId).in('user_id', userIds)
      : { data: [] as { id: string; user_id: string }[] }
    const registrationByUserId = new Map((registrations || []).map((r) => [r.user_id, r]))

    let matchedCount = 0
    let unmatchedCount = 0
    const rowInserts = rows.map((row) => {
      const { rowIndex, ...rest } = row
      const userId = userIdByEmail.get(row.email)
      const registration = userId ? registrationByUserId.get(userId) : undefined
      const matched = !!registration
      if (matched) matchedCount++
      else unmatchedCount++
      return { ...rest, match_status: matched ? 'matched' : 'unmatched', registration_id: registration?.id || null }
    })

    const { data: importRow, error: importError } = await admin
      .from('college_payment_imports')
      .insert({
        college_id: collegeId,
        hackathon_id: hackathonId,
        file_name: file.name,
        uploaded_by: adminUser.id,
        status: 'previewing',
        total_rows: rows.length,
        matched_count: matchedCount,
        unmatched_count: unmatchedCount,
      })
      .select()
      .single()

    if (importError || !importRow) {
      console.error('[college-imports/upload] import insert failed:', importError)
      return apiError('Could not save the import batch. Please try again.', 500)
    }

    const { data: insertedRows, error: rowsError } = await admin
      .from('college_payment_import_rows')
      .insert(rowInserts.map((r) => ({ ...r, import_id: importRow.id })))
      .select()

    if (rowsError) {
      console.error('[college-imports/upload] rows insert failed:', rowsError)
      await admin.from('college_payment_imports').delete().eq('id', importRow.id)
      return apiError('Could not save the import rows. Please try again.', 500)
    }

    const issueSuffix = issues.length > 0 ? `, ${issues.length} row(s) skipped — see details below` : ''
    return apiSuccess(
      { import: importRow, rows: insertedRows, issues },
      `Parsed ${rows.length} usable rows — ${matchedCount} matched, ${unmatchedCount} unmatched${issueSuffix}.`
    )
  } catch (err: any) {
    console.error('[college-imports/upload] unhandled error:', err)
    return apiError('Something went wrong. Please try again.', 500)
  }
}
