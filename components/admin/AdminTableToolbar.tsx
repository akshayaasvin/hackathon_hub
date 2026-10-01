'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Download, Trash2 } from 'lucide-react'
import { ConfirmDialog } from './ConfirmDialog'
import { downloadXlsx, type XlsxColumn } from '@/lib/exportXlsx'

/**
 * Shared bulk toolbar for admin tables — selection counter, "Download XLSX" (selected rows,
 * or all currently filtered rows when nothing is selected), and "Delete selected" with a
 * real confirmation dialog (not window.confirm — see ConfirmDialog) naming the first 5 items
 * and "and N more". Pair with useRowSelection for the checkbox state this reads.
 */
export function AdminTableToolbar<T>({
  selectedCount,
  rowsForExport,
  columns,
  filename,
  selectedRows,
  rowLabel,
  onDeleteSelected,
  deleteNoun = 'item',
  onDeleted,
  extraActions,
}: {
  selectedCount: number
  rowsForExport: T[]
  columns: XlsxColumn<T>[]
  filename: string
  selectedRows: T[]
  rowLabel: (row: T) => string
  /** Re-checks admin role server-side; returns the standard {success, message} envelope. */
  onDeleteSelected?: (rows: T[]) => Promise<{ success: boolean; message: string }>
  deleteNoun?: string
  onDeleted?: () => void
  /** Extra buttons rendered next to Download XLSX, e.g. a page-specific bulk action. */
  extraActions?: React.ReactNode
}) {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const names = selectedRows.map(rowLabel)
  const preview = names.length <= 5 ? names.join(', ') : `${names.slice(0, 5).join(', ')}, and ${names.length - 5} more`

  const handleDelete = async () => {
    if (!onDeleteSelected) return
    setDeleting(true)
    const res = await onDeleteSelected(selectedRows)
    setDeleting(false)
    setConfirmOpen(false)
    if (res.success) {
      toast.success(res.message)
      onDeleted?.()
    } else {
      toast.error(res.message)
    }
  }

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '16px' }}>
        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', minWidth: '90px' }}>
          {selectedCount} selected
        </span>
        <button
          onClick={() => downloadXlsx(rowsForExport, columns, filename)}
          disabled={rowsForExport.length === 0}
          className="btn btn-secondary"
          style={{ padding: '8px 16px', fontSize: '13px' }}
        >
          <Download size={14} /> Download XLSX
        </button>
        {extraActions}
        {onDeleteSelected && selectedCount > 0 && (
          <button
            onClick={() => setConfirmOpen(true)}
            className="btn btn-secondary"
            style={{ padding: '8px 16px', fontSize: '13px', color: 'var(--danger)' }}
          >
            <Trash2 size={14} /> Delete selected
          </button>
        )}
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title={`Delete ${selectedCount} ${deleteNoun}${selectedCount === 1 ? '' : 's'}?`}
        message={`This will remove: ${preview}\n\nThis cannot be undone.`}
        confirmLabel="Delete"
        danger
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  )
}

/** A checkbox with a 40px tap target (mobile requirement) — used for both the header
 * "select all" checkbox and every row's own checkbox, so they're consistently tappable. */
export function SelectCheckbox({ checked, indeterminate, onChange, label }: { checked: boolean; indeterminate?: boolean; onChange: () => void; label: string }) {
  return (
    <label
      style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '40px', height: '40px', cursor: 'pointer' }}
      aria-label={label}
    >
      <input
        type="checkbox"
        checked={checked}
        ref={(el) => {
          if (el) el.indeterminate = !!indeterminate
        }}
        onChange={onChange}
        style={{ width: '18px', height: '18px', cursor: 'pointer' }}
      />
    </label>
  )
}
