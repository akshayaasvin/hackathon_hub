'use client'

import { useCallback, useMemo, useState } from 'react'

/**
 * Checkbox-selection state for an admin table, shared by every page that gets the bulk
 * export/delete toolkit (see components/admin/AdminTableToolbar.tsx). Selection is keyed by
 * id and reset whenever the caller calls `clear()` (after a successful delete or a filter
 * change) — it does NOT auto-clear when `rows` changes shape on its own, since that would
 * drop a selection the admin is mid-review-of just because one row's data was patched.
 */
export function useRowSelection<T>(rows: T[], getId: (row: T) => string) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const toggle = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const toggleAll = useCallback(() => {
    setSelectedIds((prev) => {
      const ids = rows.map(getId)
      const allSelected = ids.length > 0 && ids.every((id) => prev.has(id))
      return allSelected ? new Set() : new Set(ids)
    })
  }, [rows, getId])

  const clear = useCallback(() => setSelectedIds(new Set()), [])

  const isAllSelected = rows.length > 0 && rows.every((r) => selectedIds.has(getId(r)))
  const isSomeSelected = selectedIds.size > 0 && !isAllSelected

  const selectedRows = useMemo(() => rows.filter((r) => selectedIds.has(getId(r))), [rows, selectedIds, getId])

  // "exports the selected rows if any are selected, otherwise all currently filtered rows" —
  // computed once here so every page applies this exact rule the same way.
  const rowsForExport = selectedIds.size > 0 ? selectedRows : rows

  return {
    selectedIds,
    toggle,
    toggleAll,
    clear,
    isAllSelected,
    isSomeSelected,
    selectedRows,
    rowsForExport,
    selectedCount: selectedIds.size,
  }
}
