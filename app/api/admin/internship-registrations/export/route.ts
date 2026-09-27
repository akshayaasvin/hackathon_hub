import ExcelJS from 'exceljs'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/requireAdmin'
import { applyRegistrationFilters, filtersFromSearchParams } from '@/lib/adminRegistrationFilters'
import { formatDateTimeDMY_IST } from '@/lib/dates'
import type { StoredAnswer } from '@/lib/internshipForm'

export const dynamic = 'force-dynamic'

// Postgres/PostgREST caps a single response at 1000 rows regardless of what's asked for —
// fetched in pages of this size until a short page tells us we've reached the end, so a
// 5,000+ row export is never silently truncated.
const PAGE_SIZE = 1000

// Server-side (Priority 3): generating this in the browser would mean bundling exceljs into
// the client JS (it isn't built for that — its Node-only paths break webpack) and would push
// the full unfiltered fetch through the same RLS-limited client session as the page itself.
// Doing it here also means the paginated fetch loop, the join for internship title, and the
// admin check all happen in exactly one place.
export async function GET(request: Request) {
  try {
    if (!(await requireAdmin())) return new Response('Forbidden', { status: 403 })

    const url = new URL(request.url)
    const filters = filtersFromSearchParams(url.searchParams, 'internshipId')

    const admin = createAdminClient()
    const { data: internships } = await admin.from('internships').select('id, title')
    const titleOf = (id: string) => internships?.find((i) => i.id === id)?.title || '-'

    const rows: any[] = []
    for (let offset = 0; ; offset += PAGE_SIZE) {
      let query = admin
        .from('internship_registrations')
        .select(
          'id, registration_code, internship_id, full_name, email, phone, form_answers, status, assessment_score, assessment_total, assessment_passed, amount, currency, payment_id, paid_at, created_at'
        )
        .order('created_at', { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1)
      query = applyRegistrationFilters(query as any, 'internship_id', filters, ['full_name', 'email', 'phone', 'registration_code']) as any
      const { data, error } = await query
      if (error) throw error
      rows.push(...(data ?? []))
      if (!data || data.length < PAGE_SIZE) break
    }

    // One extra column per distinct custom-question label found across the exported rows.
    const questionLabels: string[] = []
    rows.forEach((r) => ((r.form_answers as StoredAnswer[]) || []).forEach((a) => {
      if (!questionLabels.includes(a.label)) questionLabels.push(a.label)
    }))

    const headers = [
      'Registration ID', 'Internship', 'Name', 'Email', 'Phone', 'Status',
      'Assessment Status', 'Assessment Score', 'Payment Status', 'Payment Amount', 'Payment ID',
      'Registered At (IST)', ...questionLabels,
    ]

    const workbook = new ExcelJS.Workbook()
    const sheet = workbook.addWorksheet('Registrations')
    sheet.addRow(headers)
    sheet.getRow(1).font = { bold: true }

    for (const r of rows) {
      const byLabel = new Map<string, string>(
        ((r.form_answers as StoredAnswer[]) || []).map((a) => [a.label, Array.isArray(a.value) ? a.value.join('; ') : a.value])
      )
      const assessmentStatus = r.assessment_total != null ? (r.assessment_passed ? 'Eligible' : 'Not eligible') : 'Not required'
      const assessmentScore = r.assessment_total ? `${r.assessment_score}/${r.assessment_total}` : ''
      const paymentStatus = r.amount == null ? 'Not required' : r.payment_id ? 'Paid' : 'Pending'
      sheet.addRow([
        r.registration_code, titleOf(r.internship_id), r.full_name, r.email, r.phone, r.status,
        assessmentStatus, assessmentScore, paymentStatus, r.amount ?? '', r.payment_id ?? '',
        formatDateTimeDMY_IST(r.created_at),
        ...questionLabels.map((l) => byLabel.get(l) ?? ''),
      ])
    }

    sheet.columns.forEach((col) => {
      let longest = 10
      col.eachCell?.({ includeEmpty: true }, (cell) => {
        longest = Math.max(longest, String(cell.value ?? '').length + 2)
      })
      col.width = Math.min(longest, 60)
    })

    const buffer = await workbook.xlsx.writeBuffer()
    const filename = `internship-registrations_${new Date().toISOString().slice(0, 10)}.xlsx`
    return new Response(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    console.error('[admin internship-registrations export] failed:', err)
    return new Response('Export failed. Please try again.', { status: 500 })
  }
}
