'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Download, FileText, TriangleAlert, Users } from 'lucide-react'
import type { StoredAnswer } from '@/lib/internshipForm'

const STATUS_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  applied: { bg: 'rgba(107,114,128,0.15)', color: 'var(--text-secondary)', label: 'APPLIED' },
  assessment_pending: { bg: 'rgba(245,158,11,0.15)', color: '#b45309', label: 'ASSESSMENT PENDING' },
  eligible: { bg: 'rgba(59,130,246,0.15)', color: 'var(--accent)', label: 'ELIGIBLE' },
  not_eligible: { bg: 'rgba(239,68,68,0.15)', color: 'var(--danger)', label: 'NOT ELIGIBLE' },
  payment_pending: { bg: 'rgba(245,158,11,0.15)', color: '#b45309', label: 'PAYMENT PENDING' },
  registered: { bg: 'rgba(16,185,129,0.15)', color: 'var(--success)', label: 'REGISTERED' },
  active: { bg: 'rgba(16,185,129,0.15)', color: 'var(--success)', label: 'ACTIVE' },
  completed: { bg: 'rgba(99,102,241,0.15)', color: 'var(--primary)', label: 'COMPLETED' },
  certificate_issued: { bg: 'rgba(99,102,241,0.15)', color: 'var(--primary)', label: 'CERTIFICATE ISSUED' },
  rejected: { bg: 'rgba(239,68,68,0.15)', color: 'var(--danger)', label: 'REJECTED' },
}

function csvCell(value: unknown): string {
  let s = value === null || value === undefined ? '' : String(value)
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s
  if (/[",\r\n]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"'
  return s
}

export default function AdminInternshipRegistrationsPage() {
  const supabase = createClient()
  const [rows, setRows] = useState<any[]>([])
  const [internships, setInternships] = useState<any[]>([])
  const [alerts, setAlerts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [internshipFilter, setInternshipFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [search, setSearch] = useState('')

  useEffect(() => {
    ;(async () => {
      const [{ data: regs }, { data: internshipRows }, { data: events }] = await Promise.all([
        supabase.from('internship_registrations').select('*').order('created_at', { ascending: false }).limit(5000),
        supabase.from('internships').select('id, title'),
        supabase.from('payment_events').select('*').in('outcome', ['needs_review', 'amount_mismatch']).order('created_at', { ascending: false }).limit(20),
      ])
      setRows(regs || [])
      setInternships(internshipRows || [])
      setAlerts(events || [])
      setLoading(false)
    })()
  }, [])

  const titleOf = (id: string) => internships.find((i) => i.id === id)?.title || '-'

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter(
      (r) =>
        (!internshipFilter || r.internship_id === internshipFilter) &&
        (!statusFilter || r.status === statusFilter) &&
        (!q || r.full_name.toLowerCase().includes(q) || r.email.toLowerCase().includes(q) || r.phone.includes(q) || r.registration_code.toLowerCase().includes(q))
    )
  }, [rows, internshipFilter, statusFilter, search])

  const viewResume = async (registrationId: string) => {
    const res = await fetch(`/api/admin/internship-registrations/${registrationId}/resume`)
    const json = await res.json()
    if (!json?.success) {
      alert('Error: ' + json?.message)
      return
    }
    window.open(json.data.url, '_blank', 'noopener,noreferrer')
  }

  const exportCsv = () => {
    const questionLabels: string[] = []
    filtered.forEach((r) => ((r.form_answers as StoredAnswer[]) || []).forEach((a) => { if (!questionLabels.includes(a.label)) questionLabels.push(a.label) }))
    const header = ['Internship', 'Registration ID', 'Name', 'Email', 'Phone', 'Status', 'Assessment Score', 'Assessment Passed', 'Amount', 'Payment ID', 'Applied At', ...questionLabels]
    const lines = [header.map(csvCell).join(',')].concat(
      filtered.map((r) => {
        const byLabel = new Map<string, string>(((r.form_answers as StoredAnswer[]) || []).map((a) => [a.label, Array.isArray(a.value) ? a.value.join('; ') : a.value]))
        return [
          titleOf(r.internship_id), r.registration_code, r.full_name, r.email, r.phone, r.status,
          r.assessment_total ? `${r.assessment_score}/${r.assessment_total}` : '', r.assessment_passed ?? '',
          r.amount ?? '', r.payment_id ?? '', r.created_at,
          ...questionLabels.map((l) => byLabel.get(l) ?? ''),
        ].map(csvCell).join(',')
      })
    )
    const blob = new Blob(['﻿' + lines.join('\r\n') + '\r\n'], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `Internship-Registrations-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (loading) return <div style={{ padding: '100px 20px', textAlign: 'center', fontSize: '18px', color: 'var(--text-secondary)' }}>Loading registrations...</div>

  return (
    <div className="premium-container fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '32px', marginBottom: '8px', fontFamily: 'var(--font-display)', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Users size={28} /> Internship Registrations
          </h1>
          <p style={{ color: 'var(--text-secondary)' }}>{filtered.length} of {rows.length} registration{rows.length === 1 ? '' : 's'}.</p>
        </div>
        <button onClick={exportCsv} disabled={filtered.length === 0} className="btn btn-secondary"><Download size={16} /> Export CSV</button>
      </div>

      {alerts.length > 0 && (
        <div className="glass-card" style={{ marginBottom: '24px', borderLeft: '4px solid var(--warning)' }}>
          <h3 style={{ fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}><TriangleAlert size={18} /> Payments needing attention</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '12px' }}>
            Money was captured by Razorpay but could not be applied automatically. Review in the Razorpay dashboard.
          </p>
          <div style={{ display: 'grid', gap: '6px', fontSize: '13px', fontFamily: 'monospace' }}>
            {alerts.map((a) => <div key={a.id}>{new Date(a.created_at).toLocaleString()} · {a.outcome} · {a.razorpay_payment_id || '-'} · {a.razorpay_order_id || '-'}</div>)}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '20px' }}>
        <select value={internshipFilter} onChange={(e) => setInternshipFilter(e.target.value)} className="premium-input" style={{ maxWidth: '260px' }}>
          <option value="">All internships</option>
          {internships.map((i) => <option key={i.id} value={i.id}>{i.title}</option>)}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="premium-input" style={{ maxWidth: '200px' }}>
          <option value="">All statuses</option>
          {Object.entries(STATUS_STYLE).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <input value={search} onChange={(e) => setSearch(e.target.value)} className="premium-input" placeholder="Search name, email, phone, registration ID" style={{ maxWidth: '320px' }} />
      </div>

      <div className="table-container fade-in">
        <table className="premium-table">
          <thead>
            <tr>
              <th>Registrant</th>
              <th>Internship</th>
              <th>Registration ID</th>
              <th>Status</th>
              <th>Assessment</th>
              <th>Payment</th>
              <th>Resume</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>No registrations match.</td></tr>
            ) : (
              filtered.map((r) => {
                const s = STATUS_STYLE[r.status] || STATUS_STYLE.applied
                return (
                  <tr key={r.id}>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{r.full_name}</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{r.email}</div>
                    </td>
                    <td>{titleOf(r.internship_id)}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: '13px' }}>{r.registration_code}</td>
                    <td><span style={{ padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 600, background: s.bg, color: s.color }}>{s.label}</span></td>
                    <td>{r.assessment_total ? `${r.assessment_score}/${r.assessment_total}` : '-'}</td>
                    <td>{r.payment_id ? 'Paid' : r.amount != null ? 'Not required' : '-'}</td>
                    <td>
                      {r.resume_path ? (
                        <button onClick={() => viewResume(r.id)} className="btn btn-secondary" style={{ padding: '6px 10px', fontSize: '12px', display: 'inline-flex', gap: '4px' }}>
                          <FileText size={13} /> View
                        </button>
                      ) : '-'}
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
