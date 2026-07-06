'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { postJson } from '@/lib/apiFetch'
import { Check, X, CreditCard } from 'lucide-react'

export default function AdminRegistrationApprovalsPage() {
  const [rows, setRows] = useState<any[]>([])
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
    const { data: registrations } = await supabase
      .from('registrations')
      .select('*')
      .eq('status', 'payment_submitted')
      .order('registered_at', { ascending: true })

    const regs = registrations || []
    if (regs.length === 0) {
      setRows([])
      return
    }

    const userIds = [...new Set(regs.map((r: any) => r.user_id))]
    const hackathonIds = [...new Set(regs.map((r: any) => r.hackathon_id))]

    const [{ data: users }, { data: hackathons }] = await Promise.all([
      supabase.from('users').select('id, full_name, email').in('id', userIds),
      supabase.from('hackathons').select('id, name').in('id', hackathonIds),
    ])

    const enriched = regs.map((r: any) => ({
      ...r,
      participant: users?.find((u: any) => u.id === r.user_id),
      hackathon: hackathons?.find((h: any) => h.id === r.hackathon_id),
    }))
    setRows(enriched)
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
    </div>
  )
}
