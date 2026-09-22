'use client'

import { useState } from 'react'
import Link from 'next/link'
import { CalendarDays, Search } from 'lucide-react'
import { postJson } from '@/lib/apiFetch'

interface StatusResult {
  status: string
  internshipName: string | null
  internshipTopic: string | null
  duration: string | null
  startDate: string | null
  mode: string | null
  eligibilityText: string | null
  assessmentStatus: string
  assessmentScore: number | null
  assessmentTotal: number | null
  paymentStatus: string
  appliedAt: string
}

const STATUS_LABEL: Record<string, string> = {
  applied: 'Applied',
  assessment_pending: 'Assessment Pending',
  eligible: 'Eligible',
  not_eligible: 'Not Eligible',
  payment_pending: 'Payment Pending',
  registered: 'Registration Confirmed',
  active: 'Internship Active',
  completed: 'Completed',
  certificate_issued: 'Certificate Issued',
  rejected: 'Rejected',
}

const labelStyle = { display: 'block', marginBottom: '6px', fontWeight: 600, fontSize: '14px', color: 'var(--text-secondary)' } as const

// Public status lookup (section 11): /internship/status. No login — Registration ID + the
// same email used at registration is the whole check.
export default function InternshipStatusPage() {
  const [email, setEmail] = useState('')
  const [registrationCode, setRegistrationCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<StatusResult | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setResult(null)
    const res = await postJson<StatusResult>('/api/internship/status', { email, registrationCode })
    setBusy(false)
    if (!res.success || !res.data) {
      setError(res.message)
      return
    }
    setResult(res.data)
  }

  return (
    <div className="premium-container fade-in" style={{ maxWidth: '560px' }}>
      <div style={{ textAlign: 'center', marginBottom: '28px' }}>
        <h1 style={{ fontSize: '30px', fontFamily: 'var(--font-display)', marginBottom: '8px' }}>Check Application Status</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
          Enter your Registration ID and the email you applied with.
        </p>
      </div>

      <div className="glass-card" style={{ padding: '28px 24px', marginBottom: '20px' }}>
        <form onSubmit={handleSubmit}>
          {error && (
            <div role="alert" style={{ background: 'var(--danger-bg)', border: '1px solid var(--danger-border)', color: 'var(--danger)', padding: '12px', borderRadius: '8px', marginBottom: '16px', fontSize: '14px' }}>
              {error}
            </div>
          )}
          <div style={{ marginBottom: '16px' }}>
            <label htmlFor="st-email" style={labelStyle}>Email</label>
            <input id="st-email" type="email" className="premium-input" value={email} onChange={(e) => setEmail(e.target.value)} required maxLength={254} />
          </div>
          <div style={{ marginBottom: '20px' }}>
            <label htmlFor="st-code" style={labelStyle}>Registration ID</label>
            <input id="st-code" className="premium-input" placeholder="INT-2026-000123" value={registrationCode} onChange={(e) => setRegistrationCode(e.target.value)} required maxLength={30} />
          </div>
          <button type="submit" disabled={busy} className="btn btn-primary" style={{ width: '100%', padding: '14px', display: 'inline-flex', gap: '8px', justifyContent: 'center' }}>
            <Search size={16} /> {busy ? 'Checking…' : 'Check Status'}
          </button>
        </form>
      </div>

      {result && (
        <div className="glass-card" style={{ padding: '28px 24px' }}>
          <h3 style={{ fontSize: '18px', marginBottom: '4px' }}>{result.internshipName}</h3>
          {result.internshipTopic && <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>{result.internshipTopic}</p>}

          <span
            style={{
              display: 'inline-block', padding: '6px 14px', borderRadius: '20px', fontSize: '13px', fontWeight: 700, marginBottom: '18px',
              background: 'rgba(108,71,255,0.10)', color: 'var(--primary)',
            }}
          >
            {STATUS_LABEL[result.status] || result.status}
          </span>

          <div style={{ display: 'grid', gap: '10px', fontSize: '14px', color: 'var(--text-secondary)' }}>
            {result.duration && <div>Duration: {result.duration}</div>}
            {result.mode && <div style={{ textTransform: 'capitalize' }}>Mode: {result.mode}</div>}
            {result.startDate && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <CalendarDays size={14} /> Starts {new Date(result.startDate).toLocaleDateString()}
              </div>
            )}
            <div>Eligibility Assessment: {result.assessmentStatus}{result.assessmentTotal ? ` (${result.assessmentScore}/${result.assessmentTotal})` : ''}</div>
            <div>Payment Status: {result.paymentStatus}</div>
            <div>Applied on: {new Date(result.appliedAt).toLocaleDateString()}</div>
          </div>
        </div>
      )}

      <p style={{ textAlign: 'center', marginTop: '24px', fontSize: '13px', color: 'var(--text-muted)' }}>
        <Link href="/internship" style={{ color: 'var(--primary)', fontWeight: 600, textDecoration: 'none' }}>
          Browse internships
        </Link>
      </p>
    </div>
  )
}
