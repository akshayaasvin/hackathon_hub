import ExcelJS from 'exceljs'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/requireAdmin'
import { applyRegistrationFilters, filtersFromSearchParams } from '@/lib/adminRegistrationFilters'
import { formatDateTimeDMY_IST } from '@/lib/dates'
import type { StoredAnswer } from '@/lib/webinarQuestions'

export const dynamic = 'force-dynamic'

// See app/api/admin/internship-registrations/export/route.ts for why this runs server-side
// and paginates in pages of 1000 (PostgREST's per-request cap).
const PAGE_SIZE = 1000

export async function GET(request: Request) {
  try {
    if (!(await requireAdmin())) return new Response('Forbidden', { status: 403 })

    const url = new URL(request.url)
    const filters = filtersFromSearchParams(url.searchParams, 'webinarId')

    const admin = createAdminClient()
    const { data: webinars } = await admin.from('webinars').select('id, title, starts_at')
    const webinarOf = (id: string) => webinars?.find((w) => w.id === id)

    const rows: any[] = []
    for (let offset = 0; ; offset += PAGE_SIZE) {
      let query = admin
        .from('webinar_registrations')
        .select('id, webinar_id, full_name, email, phone, answers, status, amount, currency, payment_id, paid_at, created_at')
        .order('created_at', { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1)
      query = applyRegistrationFilters(query as any, 'webinar_id', filters, ['full_name', 'email', 'phone', 'payment_id']) as any
      const { data, error } = await query
      if (error) throw error
      rows.push(...(data ?? []))
      if (!data || data.length < PAGE_SIZE) break
    }

    const questionLabels: string[] = []
    rows.forEach((r) => ((r.answers as StoredAnswer[]) || []).forEach((a) => {
      if (!questionLabels.includes(a.label)) questionLabels.push(a.label)
    }))

    const headers = [
      'Webinar', 'Webinar Date (IST)', 'Name', 'Email', 'Phone', 'Status', 'Payment Status',
      'Amount', 'Payment ID', 'Registered At (IST)', ...questionLabels,
    ]

    const workbook = new ExcelJS.Workbook()
    const sheet = workbook.addWorksheet('Registrations')
    sheet.addRow(headers)
    sheet.getRow(1).font = { bold: true }

    const STATUS_LABEL: Record<string, string> = { paid: 'Paid', free: 'Free', payment_pending: 'Unpaid' }

    for (const r of rows) {
      const byLabel = new Map<string, string>(
        ((r.answers as StoredAnswer[]) || []).map((a) => [a.label, Array.isArray(a.value) ? a.value.join('; ') : a.value])
      )
      const w = webinarOf(r.webinar_id)
      sheet.addRow([
        w?.title || '-', formatDateTimeDMY_IST(w?.starts_at), r.full_name, r.email, r.phone,
        STATUS_LABEL[r.status] || r.status,
        r.amount != null && Number(r.amount) > 0 ? (r.payment_id ? 'Paid' : 'Pending') : 'Not required',
        r.amount ?? '', r.payment_id ?? '', formatDateTimeDMY_IST(r.created_at),
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
    const filename = `webinar-registrations_${new Date().toISOString().slice(0, 10)}.xlsx`
    return new Response(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    console.error('[admin webinar-registrations export] failed:', err)
    return new Response('Export failed. Please try again.', { status: 500 })
  }
}
