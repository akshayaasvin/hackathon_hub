'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Briefcase, CalendarDays } from 'lucide-react'

interface MyRegistration {
  registrationId: string
  registrationCode: string
  status: string
  assessmentScore: number | null
  assessmentTotal: number | null
  assessmentPassed: boolean | null
  paymentStatus: string
  appliedAt: string
  internship: { id: string; title: string; topic: string | null; duration: string | null; mode: string; startDate: string | null } | null
}

const STATUS_LABEL: Record<string, { label: string; bg: string; color: string }> = {
  applied: { label: 'Applied', bg: 'rgba(107,114,128,0.15)', color: 'var(--text-secondary)' },
  assessment_pending: { label: 'Assessment Pending', bg: 'rgba(245,158,11,0.15)', color: '#b45309' },
  eligible: { label: 'Eligible', bg: 'rgba(59,130,246,0.15)', color: 'var(--accent)' },
  not_eligible: { label: 'Not Eligible', bg: 'rgba(239,68,68,0.15)', color: 'var(--danger)' },
  payment_pending: { label: 'Payment Pending', bg: 'rgba(245,158,11,0.15)', color: '#b45309' },
  registered: { label: 'Registration Confirmed', bg: 'rgba(16,185,129,0.15)', color: 'var(--success)' },
  active: { label: 'Internship Active', bg: 'rgba(16,185,129,0.15)', color: 'var(--success)' },
  completed: { label: 'Completed', bg: 'rgba(99,102,241,0.15)', color: 'var(--primary)' },
  certificate_issued: { label: 'Certificate Issued', bg: 'rgba(99,102,241,0.15)', color: 'var(--primary)' },
  rejected: { label: 'Rejected', bg: 'rgba(239,68,68,0.15)', color: 'var(--danger)' },
}

// Section 14: "My Internships" for logged-in students. Internship registration itself never
// requires login (section 2) — this shows applications that got LINKED to this account,
// either automatically (session existed at registration) or by matching email.
export default function MyInternshipsPage() {
  const [registrations, setRegistrations] = useState<MyRegistration[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/internship/mine', { cache: 'no-store' })
      .then((res) => res.json())
      .then((json) => {
        if (json?.success) setRegistrations(json.data.registrations)
        else setError(json?.message || 'Could not load your internships.')
      })
      .catch(() => setError('Could not load your internships.'))
  }, [])

  return (
    <div className="premium-container fade-in">
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '32px', marginBottom: '8px', fontFamily: 'var(--font-display)', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Briefcase size={28} /> My Internships
        </h1>
        <p style={{ color: 'var(--text-secondary)' }}>
          Applications linked to this account. You can apply for a new internship anytime — no login needed.
        </p>
      </div>

      {error && (
        <div className="glass-card" style={{ padding: '24px', borderLeft: '4px solid var(--danger)', marginBottom: '20px' }}>
          {error}
        </div>
      )}

      {registrations === null && !error ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-secondary)' }}>Loading…</div>
      ) : registrations && registrations.length === 0 ? (
        <div className="glass-card" style={{ textAlign: 'center', padding: '48px 24px' }}>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '18px' }}>You haven&apos;t applied for any internships yet.</p>
          <Link href="/internship" className="btn btn-primary">Browse Internships</Link>
        </div>
      ) : (
        <div className="responsive-card-grid">
          {registrations?.map((r) => {
            const s = STATUS_LABEL[r.status] || STATUS_LABEL.applied
            return (
              <div key={r.registrationId} className="glass-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px', marginBottom: '10px' }}>
                  <h3 style={{ fontSize: '17px' }}>{r.internship?.title ?? 'Internship'}</h3>
                  <span style={{ padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 700, whiteSpace: 'nowrap', background: s.bg, color: s.color }}>
                    {s.label}
                  </span>
                </div>
                <div style={{ fontFamily: 'monospace', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px' }}>{r.registrationCode}</div>
                <div style={{ display: 'grid', gap: '6px', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                  {r.internship?.duration && <div>Duration: {r.internship.duration}</div>}
                  {r.internship?.mode && <div style={{ textTransform: 'capitalize' }}>Mode: {r.internship.mode}</div>}
                  {r.internship?.startDate && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <CalendarDays size={13} /> Starts {new Date(r.internship.startDate).toLocaleDateString()}
                    </div>
                  )}
                  {r.assessmentTotal != null && r.assessmentTotal > 0 && (
                    <div>Assessment: {r.assessmentScore}/{r.assessmentTotal} ({r.assessmentPassed ? 'Passed' : 'Not passed'})</div>
                  )}
                  <div>Payment: {r.paymentStatus}</div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
