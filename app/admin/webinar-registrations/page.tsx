'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Download, TriangleAlert, Users } from 'lucide-react'
import type { StoredAnswer } from '@/lib/webinarQuestions'
import DateRangeFilter, { ALL_DATES, type DateRangeState } from '@/components/admin/DateRangeFilter'
import { applyRegistrationFilters, type RegistrationFilters } from '@/lib/adminRegistrationFilters'
import { formatInstantDateDMY_IST } from '@/lib/dates'

const STATUS_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  paid: { bg: 'rgba(16, 185, 129, 0.15)', color: 'var(--success)', label: 'PAID' },
  free: { bg: 'rgba(59, 130, 246, 0.15)', color: 'var(--accent)', label: 'FREE' },
  payment_pending: { bg: 'rgba(245, 158, 11, 0.15)', color: '#b45309', label: 'UNPAID' },
}

const answerText = (a: StoredAnswer) => (Array.isArray(a.value) ? a.value.join('; ') : a.value)

const PAGE_SIZE = 50
const SELECT_ALL_CAP = 20_000
const SEARCH_COLUMNS = ['full_name', 'email', 'phone', 'payment_id']

export default function AdminWebinarRegistrationsPage() {
  const supabase = createClient()
  const [rows, setRows] = useState<any[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [page, setPage] = useState(0)
  const [webinars, setWebinars] = useState<any[]>([])
  const [alerts, setAlerts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [webinarFilter, setWebinarFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [dateRange, setDateRange] = useState<DateRangeState>(ALL_DATES)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [selectingAll, setSelectingAll] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmTyped, setConfirmTyped] = useState('')
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 350)
    return () => clearTimeout(t)
  }, [searchInput])

  const filters: RegistrationFilters = useMemo(
    () => ({ targetId: webinarFilter, status: statusFilter, search, dateFrom: dateRange.from, dateTo: dateRange.to }),
    [webinarFilter, statusFilter, search, dateRange]
  )

  useEffect(() => {
    ;(async () => {
      const [{ data: webs }, { data: events }] = await Promise.all([
        supabase.from('webinars').select('id, title'),
        supabase.from('payment_events').select('*').in('outcome', ['needs_review', 'amount_mismatch']).order('created_at', { ascending: false }).limit(20),
      ])
      setWebinars(webs || [])
      setAlerts(events || [])
    })()
  }, [])

  const load = async () => {
    setLoading(true)
    let query = supabase
      .from('webinar_registrations')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1)
    query = applyRegistrationFilters(query as any, 'webinar_id', filters, SEARCH_COLUMNS) as any
    const { data, count, error } = await query
    if (error) {
      console.error('[admin webinar-registrations] load failed:', error)
      setRows([])
      setTotalCount(0)
    } else {
      setRows(data || [])
      setTotalCount(count ?? 0)
    }
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [filters, page])

  useEffect(() => {
    setSelected(new Set())
  }, [filters])

  const updateFilter = (fn: () => void) => {
    fn()
    setPage(0)
  }

  const titleOf = (id: string) => webinars.find((w) => w.id === id)?.title || '-'
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

  const pageIds = rows.map((r) => r.id)
  const allOnPageSelected = pageIds.length > 0 && pageIds.every((id) => selected.has(id))

  const toggleRow = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAllOnPage = () => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (allOnPageSelected) pageIds.forEach((id) => next.delete(id))
      else pageIds.forEach((id) => next.add(id))
      return next
    })
  }

  const selectAllMatching = async () => {
    setSelectingAll(true)
    try {
      const ids: string[] = []
      const cap = Math.min(totalCount, SELECT_ALL_CAP)
      for (let offset = 0; offset < cap; offset += 1000) {
        let q = supabase.from('webinar_registrations').select('id').order('created_at', { ascending: false }).range(offset, Math.min(offset + 999, cap - 1))
        q = applyRegistrationFilters(q as any, 'webinar_id', filters, SEARCH_COLUMNS) as any
        const { data, error } = await q
        if (error) break
        ids.push(...(data || []).map((r: any) => r.id))
        if (!data || data.length === 0) break
      }
      setSelected(new Set(ids))
    } finally {
      setSelectingAll(false)
    }
  }

  const handleExport = async () => {
    setExporting(true)
    try {
      const params = new URLSearchParams()
      if (filters.targetId) params.set('webinarId', filters.targetId)
      if (filters.status) params.set('status', filters.status)
      if (filters.search) params.set('search', filters.search)
      if (filters.dateFrom) params.set('dateFrom', filters.dateFrom)
      if (filters.dateTo) params.set('dateTo', filters.dateTo)
      const res = await fetch(`/api/admin/webinar-registrations/export?${params.toString()}`, { cache: 'no-store' })
      if (!res.ok) {
        alert('Export failed. Please try again.')
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `webinar-registrations_${new Date().toISOString().slice(0, 10)}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setExporting(false)
    }
  }

  const openDeleteConfirm = () => {
    setConfirmTyped('')
    setConfirmOpen(true)
  }

  const handleBulkDelete = async () => {
    const ids = Array.from(selected)
    if (ids.length === 0) return
    setDeleting(true)
    try {
      const res = await fetch('/api/admin/webinar-registrations/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      }).then((r) => r.json())
      if (!res.success) {
        alert('Error: ' + res.message)
        return
      }
      alert(res.message)
      setSelected(new Set())
      setConfirmOpen(false)
      setPage(0)
      await load()
    } finally {
      setDeleting(false)
    }
  }

  const needsTypedConfirm = selected.size > 50
  const canConfirmDelete = selected.size > 0 && (!needsTypedConfirm || confirmTyped.trim().toUpperCase() === 'DELETE')

  if (loading && rows.length === 0) {
    return <div style={{ padding: '100px 20px', textAlign: 'center', fontSize: '18px', color: 'var(--text-secondary)' }}>Loading registrations...</div>
  }

  return (
    <div className="premium-container fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '32px', marginBottom: '8px', fontFamily: 'var(--font-display)', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Users size={28} /> Webinar Registrations
          </h1>
          <p style={{ color: 'var(--text-secondary)' }}>
            {totalCount} registration{totalCount === 1 ? '' : 's'} match the current filters. Hackathon payments are under Payment Approvals.
          </p>
        </div>
        <button onClick={handleExport} disabled={exporting || totalCount === 0} className="btn btn-secondary">
          <Download size={16} /> {exporting ? 'Exporting…' : 'Export to Excel'}
        </button>
      </div>

      {alerts.length > 0 && (
        <div className="glass-card" style={{ marginBottom: '24px', borderLeft: '4px solid var(--warning)' }}>
          <h3 style={{ fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <TriangleAlert size={18} /> Payments needing attention
          </h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '12px' }}>
            Money was captured by Razorpay but could not be applied automatically (amount mismatch, or the registration was
            already settled by a different payment). Review in the Razorpay dashboard — refund if it is a duplicate.
          </p>
          <div style={{ display: 'grid', gap: '6px', fontSize: '13px', fontFamily: 'monospace' }}>
            {alerts.map((a) => (
              <div key={a.id}>
                {formatInstantDateDMY_IST(a.created_at)} · {a.outcome} · {a.razorpay_payment_id || '-'} · {a.razorpay_order_id || '-'}
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <select value={webinarFilter} onChange={(e) => updateFilter(() => setWebinarFilter(e.target.value))} className="premium-input" style={{ maxWidth: '260px' }}>
            <option value="">All webinars</option>
            {webinars.map((w) => (
              <option key={w.id} value={w.id}>{w.title}</option>
            ))}
          </select>
          <select value={statusFilter} onChange={(e) => updateFilter(() => setStatusFilter(e.target.value))} className="premium-input" style={{ maxWidth: '180px' }}>
            <option value="">All statuses</option>
            <option value="paid">Paid</option>
            <option value="free">Free</option>
            <option value="payment_pending">Unpaid</option>
          </select>
          <input
            value={searchInput}
            onChange={(e) => { setSearchInput(e.target.value); setPage(0) }}
            className="premium-input"
            placeholder="Search name, email, phone, payment id"
            style={{ maxWidth: '320px' }}
          />
        </div>
        <DateRangeFilter value={dateRange} onChange={(v) => updateFilter(() => setDateRange(v))} />
      </div>

      {selected.size > 0 && (
        <div className="glass-card" style={{ marginBottom: '16px', padding: '14px 18px', display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap', borderLeft: '4px solid var(--primary)' }}>
          <strong>{selected.size} selected</strong>
          {selected.size < totalCount && (
            <button onClick={selectAllMatching} disabled={selectingAll} className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '12px' }}>
              {selectingAll ? 'Selecting…' : `Select all ${totalCount} matching filters`}
            </button>
          )}
          <button onClick={() => setSelected(new Set())} className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '12px' }}>Clear selection</button>
          <button onClick={openDeleteConfirm} className="btn btn-danger" style={{ padding: '6px 14px', fontSize: '12px', marginLeft: 'auto' }}>
            Delete selected ({selected.size})
          </button>
        </div>
      )}

      <div className="table-container fade-in">
        <table className="premium-table">
          <thead>
            <tr>
              <th style={{ width: '36px' }}>
                <input type="checkbox" checked={allOnPageSelected} onChange={toggleAllOnPage} aria-label="Select all on this page" />
              </th>
              <th>Registrant</th>
              <th>Webinar</th>
              <th>Phone</th>
              <th>Status</th>
              <th>Amount</th>
              <th>Payment ID</th>
              <th>Answers</th>
              <th>Registered</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={9} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
                  No registrations match.
                </td>
              </tr>
            ) : (
              rows.map((r) => {
                const s = STATUS_STYLE[r.status] || STATUS_STYLE.payment_pending
                const answers: StoredAnswer[] = Array.isArray(r.answers) ? r.answers : []
                return (
                  <tr key={r.id}>
                    <td><input type="checkbox" checked={selected.has(r.id)} onChange={() => toggleRow(r.id)} aria-label={`Select ${r.full_name}`} /></td>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{r.full_name}</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{r.email}</div>
                    </td>
                    <td>{titleOf(r.webinar_id)}</td>
                    <td>{r.phone}</td>
                    <td>
                      <span style={{ padding: '4px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 600, background: s.bg, color: s.color }}>{s.label}</span>
                    </td>
                    <td>{r.amount != null && Number(r.amount) > 0 ? `₹${r.amount}` : '-'}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: '13px' }}>{r.payment_id || '-'}</td>
                    <td style={{ minWidth: '200px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                      {answers.length === 0
                        ? '-'
                        : answers.map((a) => (
                            <div key={a.id}>
                              <strong>{a.label}:</strong> {answerText(a)}
                            </div>
                          ))}
                    </td>
                    <td>{formatInstantDateDMY_IST(r.created_at)}</td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '14px', marginTop: '20px' }}>
          <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0} className="btn btn-secondary" style={{ padding: '8px 16px' }}>Prev</button>
          <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Page {page + 1} of {totalPages}</span>
          <button onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} className="btn btn-secondary" style={{ padding: '8px 16px' }}>Next</button>
        </div>
      )}

      {confirmOpen && (
        <div className="modal-overlay">
          <div className="glass-card" style={{ width: '100%', maxWidth: '460px', padding: '32px' }}>
            <h3 style={{ fontSize: '18px', marginBottom: '8px' }}>Delete {selected.size} registration{selected.size === 1 ? '' : 's'}?</h3>
            <p style={{ color: 'var(--danger)', fontWeight: 600, fontSize: '14px', marginBottom: '12px' }}>This is permanent and cannot be undone.</p>
            <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '20px' }}>
              Any related payment records are deleted with them. The webinar itself is never affected.
            </p>
            {needsTypedConfirm && (
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: 600 }}>
                  Type <strong>DELETE</strong> to confirm deleting more than 50 registrations.
                </label>
                <input className="premium-input" value={confirmTyped} onChange={(e) => setConfirmTyped(e.target.value)} placeholder="DELETE" />
              </div>
            )}
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button onClick={() => setConfirmOpen(false)} className="btn btn-secondary" style={{ padding: '8px 16px' }}>Cancel</button>
              <button onClick={handleBulkDelete} disabled={deleting || !canConfirmDelete} className="btn btn-danger" style={{ padding: '8px 20px' }}>
                {deleting ? 'Deleting…' : `Delete ${selected.size}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
