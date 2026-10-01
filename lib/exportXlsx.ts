'use client'

export interface XlsxColumn<T> {
  header: string
  value: (row: T) => string | number | null | undefined
  width?: number
}

/**
 * Client-side XLSX export via exceljs (never the `xlsx` npm package — it's unmaintained and
 * has known vulnerabilities). Every admin table's "Download XLSX" button goes through this
 * one function so every export gets the same human-readable-headers behavior for free.
 * exceljs is dynamically imported here (~270KB) so it's only ever fetched when an admin
 * actually clicks "Download XLSX", instead of bloating every admin page's initial bundle.
 */
export async function downloadXlsx<T>(rows: T[], columns: XlsxColumn<T>[], filename: string) {
  const { default: ExcelJS } = await import('exceljs')
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('Sheet1')
  sheet.columns = columns.map((c) => ({ header: c.header, width: c.width ?? 24 }))
  sheet.getRow(1).font = { bold: true }
  for (const row of rows) {
    sheet.addRow(columns.map((c) => c.value(row) ?? ''))
  }

  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/** `<page>-<hackathon-slug>-<YYYY-MM-DD>.xlsx`, e.g. "submissions-summer-hack-2026-10-01.xlsx". */
export function xlsxFilename(page: string, hackathonName: string | null | undefined) {
  const date = new Date().toISOString().slice(0, 10)
  const slug = (hackathonName || 'all').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'all'
  return `${page}-${slug}-${date}.xlsx`
}
