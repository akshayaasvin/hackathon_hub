'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { postJson } from '@/lib/apiFetch'
import { Check, X, CreditCard, ShieldCheck } from 'lucide-react'

export default function AdminRegistrationApprovalsPage() {
  const [rows, setRows] = useState<any[]>([])
  const [autoApprovedRows, setAutoApprovedRows] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [processingId, setProcessingId] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    checkAdminAndLoad()
  }, [])

  const checkAdminAndLoad = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }
      const { data: userData } = await supabase.from('users').select('role').eq('id', user.id).single()
      if (userData?.role !== 'admin') {
        router.push('/participant')
        return
      }
      await loadRegistrations()
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const loadRegistrations = async () => {
    const [{ data: registrations }, { data: autoApproved }] = await Promise.all([
      supabase
        .from('registrations')
        .select('*')
        .eq('status', 'payment_submitted')
        .order('registered_at', { ascending: true }),
      // Razorpay webhook verified these directly (status skipped straight to
      // 'approved' or beyond) — never routed through this page's Approve/
      // Reject action. Shown read-only below for audit visibility only.
      supabase
        .from('registrations')
        .select('*')
        .eq('payment_method', 'razorpay')
        .in('status', ['approved', 'team_created', 'submitted'])
        .order('reviewed_at', { ascending: false }),
    ])

    const regs = registrations || []
    const autoRegs = autoApproved || []
    if (regs.length === 0 && autoRegs.length === 0) {
      setRows([])
      setAutoApprovedRows([])
      return
    }

    const allRegs = [...regs, ...autoRegs]
    const userIds = [...new Set(allRegs.map((r: any) => r.user_id))]
    const hackathonIds = [...new Set(allRegs.map((r: any) => r.hackathon_id))]

    const [{ data: users }, { data: hackathons }] = await Promise.all([
      supabase.from('users').select('id, full_name, email').in('id', userIds),
      supabase.from('hackathons').select('id, name').in('id', hackathonIds),
    ])

    const enrich = (list: any[]) =>
      list.map((r: any) => ({
        ...r,
        participant: users?.find((u: any) => u.id === r.user_id),
        hackathon: hackathons?.find((h: any) => h.id === r.hackathon_id),
      }))

    setRows(enrich(regs))
    setAutoApprovedRows(enrich(autoRegs))
  }

  const handleAction = async (registrationId: string, action: 'approve' | 'reject') => {
    setProcessingId(registrationId)
    try {
      const result = await postJson(`/api/registrations/${registrationId}/approve`, { action })
      if (!result.success) {
        alert('Error: ' + result.message)
        return
      }
      await loadRegistrations()
    } finally {
      setProcessingId(null)
    }
  }

  if (loading) {
    return <div style={{ padding: '100px 20px', textAlign: 'center', fontSize: '18px', color: 'var(--text-secondary)' }}>Loading Payment Approvals...</div>
  }

  return (
    <div className="premium-container fade-in">
      <div style={{ marginBottom: '40px' }}>
        <h1 style={{ fontSize: '32px', marginBottom: '8px', fontFamily: 'var(--font-display)', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <CreditCard size={28} /> Payment Approvals
        </h1>
        <p style={{ color: 'var(--text-secondary)' }}>
          Registrations awaiting payment verification. Approve to let the participant create a team, or reject to send them back to payment.
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="glass-card" style={{ textAlign: 'center', padding: '60px 40px', borderLeft: '4px solid var(--success)' }}>
          <h3 style={{ fontSize: '20px', marginBottom: '8px', color: 'var(--text-primary)' }}>All caught up</h3>
          <p style={{ color: 'var(--text-secondary)' }}>No payments are currently awaiting review.</p>
        </div>
      ) : (
        <div className="table-container fade-in">
          <table className="premium-table">
            <thead>
              <tr>
                <th>Participant</th>
                <th>Hackathon</th>
                <th>Amount</th>
                <th>Payment Reference</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{r.participant?.full_name || 'Unnamed'}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{r.participant?.email}</div>
                  </td>
                  <td>{r.hackathon?.name || '-'}</td>
                  <td>{r.payment_amount != null ? `₹${r.payment_amount}` : '-'}</td>
                  <td style={{ fontFamily: 'monospace', fontSize: '13px' }}>{r.payment_reference || '-'}</td>
                  <td>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={() => handleAction(r.id, 'approve')}
                        disabled={processingId === r.id}
                        className="btn btn-success"
                        style={{ padding: '6px 12px', fontSize: '13px' }}
                      >
                        <Check size={14} /> Approve
                      </button>
                      <button
                        onClick={() => handleAction(r.id, 'reject')}
                        disabled={processingId === r.id}
                        className="btn btn-danger"
                        style={{ padding: '6px 12px', fontSize: '13px' }}
                      >
                        <X size={14} /> Reject
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ margin: '48px 0 20px' }}>
        <h2 style={{ fontSize: '20px', marginBottom: '8px', fontFamily: 'var(--font-display)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ShieldCheck size={20} /> Auto-Approved Razorpay Payments
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
          Verified automatically by the Razorpay webhook — the participant already moved on to the next step.
          Shown here for reference only; no action needed.
        </p>
      </div>

      {autoApprovedRows.length === 0 ? (
        <div className="glass-card" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
          No auto-approved Razorpay payments yet.
        </div>
      ) : (
        <div className="table-container fade-in">
          <table className="premium-table">
            <thead>
              <tr>
                <th>Participant</th>
                <th>Hackathon</th>
                <th>Amount</th>
                <th>Transaction ID</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {autoApprovedRows.map((r) => (
                <tr key={r.id}>
                  <td>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{r.participant?.full_name || 'Unnamed'}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{r.participant?.email}</div>
                  </td>
                  <td>{r.hackathon?.name || '-'}</td>
                  <td>{r.payment_amount != null ? `₹${r.payment_amount}` : '-'}</td>
                  <td style={{ fontFamily: 'monospace', fontSize: '13px' }}>{r.payment_reference || '-'}</td>
                  <td style={{ textTransform: 'capitalize' }}>{r.status.replace('_', ' ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
