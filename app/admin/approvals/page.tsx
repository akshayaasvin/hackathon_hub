'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { postJson } from '@/lib/apiFetch'
import { Check, X, School, Gavel } from 'lucide-react'

interface PendingUser {
  id: string
  email: string
  full_name: string
  role: 'college' | 'jury'
  created_at: string
  profile: Record<string, any> | null
}

export default function AdminApprovalsPage() {
  const [pending, setPending] = useState<PendingUser[]>([])
  const [loading, setLoading] = useState(true)
  const [processingId, setProcessingId] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    checkAdminAndLoad()
  }, [])

  const checkAdminAndLoad = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      const { data: userData } = await supabase.from('users').select('role').eq('id', user.id).single()
      if (userData?.role !== 'admin') {
        router.push('/participant')
        return
      }

      await loadPending()
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadPending = async () => {
    const { data: users, error } = await supabase
      .from('users')
      .select('*')
      .in('role', ['college', 'jury'])
      .eq('status', 'pending')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching pending users:', error)
      return
    }

    const collegeIds = (users || []).filter((u) => u.role === 'college').map((u) => u.id)
    const juryIds = (users || []).filter((u) => u.role === 'jury').map((u) => u.id)

    const [{ data: collegeProfiles }, { data: juryProfiles }] = await Promise.all([
      collegeIds.length
        ? supabase.from('college_profiles').select('*').in('user_id', collegeIds)
        : Promise.resolve({ data: [] as any[] }),
      juryIds.length
        ? supabase.from('jury_profiles').select('*').in('user_id', juryIds)
        : Promise.resolve({ data: [] as any[] }),
    ])

    const merged: PendingUser[] = (users || []).map((u) => ({
      ...u,
      profile:
        u.role === 'college'
          ? (collegeProfiles || []).find((p) => p.user_id === u.id) || null
          : (juryProfiles || []).find((p) => p.user_id === u.id) || null,
    }))

    setPending(merged)
  }

  const handleAction = async (userId: string, action: 'approve' | 'reject') => {
    let reason: string | undefined
    if (action === 'reject') {
      reason = prompt('Reason for rejection (optional):') || undefined
    }

    setProcessingId(userId)
    try {
      const result = await postJson('/api/admin/approvals', { action, userId, reason })
      if (!result.success) {
        alert('Error: ' + result.message)
        return
      }
      await loadPending()
    } finally {
      setProcessingId(null)
    }
  }

  if (loading) {
    return (
      <div style={{ padding: '100px 20px', textAlign: 'center', fontSize: '18px', color: 'var(--text-secondary)' }}>
        Loading Approvals Panel...
      </div>
    )
  }

  return (
    <div className="premium-container fade-in">
      <div style={{ marginBottom: '40px' }}>
        <h1 style={{ fontSize: '32px', marginBottom: '8px', fontFamily: 'var(--font-display)' }}>
          Account Approvals
        </h1>
        <p style={{ color: 'var(--text-secondary)' }}>
          Review pending college and jury registrations. Approving generates login credentials and emails
          them to the applicant.
        </p>
      </div>

      {pending.length === 0 ? (
        <div className="glass-card" style={{ textAlign: 'center', padding: '60px 40px', borderLeft: '4px solid var(--success)' }}>
          <h3 style={{ fontSize: '20px', marginBottom: '8px', color: 'var(--text-primary)' }}>All caught up</h3>
          <p style={{ color: 'var(--text-secondary)' }}>There are no accounts currently awaiting approval.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {pending.map((u) => (
            <div key={u.id} className="glass-card" style={{ borderLeft: '4px solid var(--warning)', padding: '28px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '20px', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: '280px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                    {u.role === 'college' ? (
                      <School size={18} color="var(--primary)" />
                    ) : (
                      <Gavel size={18} color="var(--primary)" />
                    )}
                    <h3 style={{ fontSize: '18px', color: 'var(--text-primary)', textTransform: 'capitalize' }}>
                      {u.role} application
                    </h3>
                  </div>

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                      gap: '10px',
                      fontSize: '14px',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    {u.role === 'college' ? (
                      <>
                        <p><strong>College:</strong> <span style={{ color: 'var(--text-primary)' }}>{u.profile?.college_name || '-'}</span></p>
                        <p><strong>Representative:</strong> {u.profile?.representative_name || '-'}</p>
                        <p><strong>Position:</strong> {u.profile?.position_in_college || '-'}</p>
                        <p><strong>Official Email:</strong> {u.profile?.official_email || u.email}</p>
                        <p><strong>Personal Email:</strong> {u.profile?.personal_email || '-'}</p>
                        <p><strong>Contact:</strong> {u.profile?.contact_number || '-'}</p>
                        <p><strong>Department:</strong> {u.profile?.department || '-'}</p>
                        <p><strong>Address:</strong> {u.profile?.college_address || '-'}</p>
                        <p><strong>Date of Birth:</strong> {u.profile?.date_of_birth || '-'}</p>
                      </>
                    ) : (
                      <>
                        <p><strong>Full Name:</strong> <span style={{ color: 'var(--text-primary)' }}>{u.profile?.full_name || u.full_name}</span></p>
                        <p><strong>Email:</strong> {u.profile?.email || u.email}</p>
                        <p><strong>Official Email:</strong> {u.profile?.official_email || '-'}</p>
                        <p><strong>Contact:</strong> {u.profile?.contact_number || '-'}</p>
                        <p><strong>Occupation:</strong> {u.profile?.occupation || '-'}</p>
                        <p><strong>Organization:</strong> {u.profile?.organization_name || '-'}</p>
                        <p><strong>Portfolio:</strong> {u.profile?.portfolio_url || '-'}</p>
                        <p><strong>Experience (yrs):</strong> {u.profile?.experience_years ?? '-'}</p>
                        <p><strong>Location:</strong> {u.profile?.location || '-'}</p>
                        <p><strong>Date of Birth:</strong> {u.profile?.date_of_birth || '-'}</p>
                      </>
                    )}
                    <p><strong>Applied:</strong> {new Date(u.created_at).toLocaleDateString()}</p>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                  <button
                    onClick={() => handleAction(u.id, 'approve')}
                    disabled={processingId === u.id}
                    className="btn btn-success"
                    style={{ padding: '10px 18px' }}
                  >
                    <Check size={16} /> Approve
                  </button>
                  <button
                    onClick={() => handleAction(u.id, 'reject')}
                    disabled={processingId === u.id}
                    className="btn btn-danger"
                    style={{ padding: '10px 18px' }}
                  >
                    <X size={16} /> Reject
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
