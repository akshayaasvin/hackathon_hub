'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { postJson } from '@/lib/apiFetch'
import { Download, Mail, TriangleAlert, Users } from 'lucide-react'
import type { StoredAnswer } from '@/lib/webinarQuestions'

const STATUS_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  paid: { bg: 'rgba(16, 185, 129, 0.15)', color: 'var(--success)', label: 'PAID' },
  free: { bg: 'rgba(59, 130, 246, 0.15)', color: 'var(--accent)', label: 'FREE' },
  payment_pending: { bg: 'rgba(245, 158, 11, 0.15)', color: '#b45309', label: 'UNPAID' },
}

// Neutralises spreadsheet formula injection (=, +, -, @) and quotes for CSV.
function csvCell(value: unknown): string {
  let s = value === null || value === undefined ? '' : String(value)
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s
  if (/[",\r\n]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"'
  return s
}

const answerText = (a: StoredAnswer) => (Array.isArray(a.value) ? a.value.join('; ') : a.value)

export default function AdminWebinarRegistrationsPage() {
  const supabase = createClient()
  const [rows, setRows] = useState<any[]>([])
  const [webinars, setWebinars] = useState<any[]>([])
  const [alerts, setAlerts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [webinarFilter, setWebinarFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [search, setSearch] = useState('')
  const [emailingId, setEmailingId] = useState<string | null>(null)

  useEffect(() => {
    ;(async () => {
      const [{ data: regs }, { data: webs }, { data: events }] = await Promise.all([
        supabase.from('webinar_registrations').select('*').order('created_at', { ascending: false }).limit(5000),
        supabase.from('webinars').select('id, title'),
        // Captured payments the system refused to apply automatically (any product).
        supabase
          .from('payment_events')
          .select('*')
          .in('outcome', ['needs_review', 'amount_mismatch'])
          .order('created_at', { ascending: false })
          .limit(20),
      ])
      setRows(regs || [])
      setWebinars(webs || [])
      setAlerts(events || [])
      setLoading(false)
    })()
  }, [])

  const titleOf = (id: string) => webinars.find((w) => w.id === id)?.title || '-'

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter(
      (r) =>
        (!webinarFilter || r.webinar_id === webinarFilter) &&
        (!statusFilter || r.status === statusFilter) &&
        (!q ||
          r.full_name.toLowerCase().includes(q) ||
          r.email.toLowerCase().includes(q) ||
          r.phone.includes(q) ||
          (r.payment_id || '').toLowerCase().includes(q))
    )
  }, [rows, webinarFilter, statusFilter, search])

  const resendEmail = async (id: string) => {
    setEmailingId(id)
    const res = await postJson(`/api/admin/webinar-registrations/${id}/resend`, {})
    setEmailingId(null)
    alert(res.message)
  }

  const exportCsv = () => {
    // One extra column per distinct question label found in the exported rows.
    const questionLabels: string[] = []
    filtered.forEach((r) =>
      ((r.answers as StoredAnswer[]) || []).forEach((a) => {
        if (!questionLabels.includes(a.label)) questionLabels.push(a.label)
      })
    )
    const header = ['Webinar', 'Name', 'Email', 'Phone', 'Status', 'Amount', 'Payment ID', 'Registered at', 'Paid at', ...questionLabels]
    const lines = [header.map(csvCell).join(',')].concat(
      filtered.map((r) => {
        const byLabel = new Map<string, string>(((r.answers as StoredAnswer[]) || []).map((a) => [a.label, answerText(a)]))
        return [
          titleOf(r.webinar_id), r.full_name, r.email, r.phone, r.status, r.amount ?? '', r.payment_id ?? '', r.created_at, r.paid_at ?? '',
          ...questionLabels.map((l) => byLabel.get(l) ?? ''),
        ]
          .map(csvCell)
          .join(',')
      })
    )
    const blob = new Blob(['﻿' + lines.join('\r\n') + '\r\n'], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `Webinar-Registrations-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (loading) {
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
            {filtered.length} of {rows.length} registration{rows.length === 1 ? '' : 's'}. Hackathon payments are under Payment Approvals.
          </p>
        </div>
        <button onClick={exportCsv} disabled={filtered.length === 0} className="btn btn-secondary">
          <Download size={16} /> Export CSV
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
                {new Date(a.created_at).toLocaleString()} · {a.outcome} · {a.razorpay_payment_id || '-'} · {a.razorpay_order_id || '-'}
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '20px' }}>
        <select value={webinarFilter} onChange={(e) => setWebinarFilter(e.target.value)} className="premium-input" style={{ maxWidth: '260px' }}>
          <option value="">All webinars</option>
          {webinars.map((w) => (
            <option key={w.id} value={w.id}>
              {w.title}
            </option>
          ))}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="premium-input" style={{ maxWidth: '180px' }}>
          <option value="">All statuses</option>
          <option value="paid">Paid</option>
          <option value="free">Free</option>
          <option value="payment_pending">Unpaid</option>
        </select>
        <input value={search} onChange={(e) => setSearch(e.target.value)} className="premium-input" placeholder="Search name, email, phone, payment id" style={{ maxWidth: '320px' }} />
      </div>

      <div className="table-container fade-in">
        <table className="premium-table">
          <thead>
            <tr>
              <th>Registrant</th>
              <th>Webinar</th>
              <th>Phone</th>
              <th>Status</th>
              <th>Amount</th>
              <th>Payment ID</th>
              <th>Answers</th>
              <th>Registered</th>
              <th>Email</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={9} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
                  No registrations match.
                </td>
              </tr>
            ) : (
              filtered.map((r) => {
                const s = STATUS_STYLE[r.status] || STATUS_STYLE.payment_pending
                const answers: StoredAnswer[] = Array.isArray(r.answers) ? r.answers : []
                return (
                  <tr key={r.id}>
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
                    <td>{new Date(r.created_at).toLocaleString()}</td>
                    <td>
                      {r.status === 'paid' || r.status === 'free' ? (
                        <button
                          onClick={() => resendEmail(r.id)}
                          disabled={emailingId === r.id}
                          className="btn btn-secondary"
                          style={{ padding: '6px 10px', fontSize: '12px', display: 'inline-flex', gap: '6px' }}
                          title="Re-send the confirmation email with the meeting link"
                        >
                          <Mail size={13} /> {emailingId === r.id ? 'Sending…' : 'Resend'}
                        </button>
                      ) : (
                        '-'
                      )}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
