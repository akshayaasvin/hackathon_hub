'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { postJson } from '@/lib/apiFetch'
import { Check, X, School, Gavel, MessageSquareWarning, Clock } from 'lucide-react'

interface Application {
  id: string
  role: 'college' | 'jury'
  status: 'pending' | 'approved' | 'rejected' | 'changes_requested'
  created_at: string
  admin_notes: string | null
  [key: string]: any
}

export default function AdminApprovalsPage() {
  const [pending, setPending] = useState<Application[]>([])
  const [awaitingApplicant, setAwaitingApplicant] = useState<Application[]>([])
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

      await loadApplications()
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadApplications = async () => {
    const [collegeRes, juryRes] = await Promise.all([
      supabase.from('college_applications').select('*').order('created_at', { ascending: false }),
      supabase.from('jury_applications').select('*').order('created_at', { ascending: false }),
    ])

    const all: Application[] = [
      ...(collegeRes.data || []).map((a: any) => ({ ...a, role: 'college' as const })),
      ...(juryRes.data || []).map((a: any) => ({ ...a, role: 'jury' as const })),
    ]

    setPending(all.filter((a) => a.status === 'pending'))
    setAwaitingApplicant(all.filter((a) => a.status === 'changes_requested'))
  }

  const handleAction = async (application: Application, action: 'approve' | 'reject' | 'request_changes') => {
    let reason: string | undefined
    if (action === 'reject') {
      reason = prompt('Reason for rejection (optional):') || undefined
    }
    if (action === 'request_changes') {
      const note = prompt('What does the applicant need to fix? (required, this gets emailed to them)')
      if (!note?.trim()) return
      reason = note.trim()
    }

    setProcessingId(application.id)
    try {
      const result = await postJson('/api/admin/approvals', {
        action,
        role: application.role,
        applicationId: application.id,
        reason,
      })
      if (!result.success) {
        alert('Error: ' + result.message)
        return
      }
      await loadApplications()
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

  const renderFields = (app: Application) =>
    app.role === 'college' ? (
      <>
        <p><strong>College:</strong> <span style={{ color: 'var(--text-primary)' }}>{app.college_name || '-'}</span></p>
        <p><strong>Representative:</strong> {app.representative_name || '-'}</p>
        <p><strong>Position:</strong> {app.position_in_college || '-'}</p>
        <p><strong>Official Email:</strong> {app.official_email}</p>
        <p><strong>Personal Email:</strong> {app.personal_email || '-'}</p>
        <p><strong>Contact:</strong> {app.contact_number || '-'}</p>
        <p><strong>Department:</strong> {app.department || '-'}</p>
        <p><strong>Address:</strong> {app.college_address || '-'}</p>
        <p><strong>Date of Birth:</strong> {app.date_of_birth || '-'}</p>
      </>
    ) : (
      <>
        <p><strong>Full Name:</strong> <span style={{ color: 'var(--text-primary)' }}>{app.full_name}</span></p>
        <p><strong>Email:</strong> {app.email}</p>
        <p><strong>Official Email:</strong> {app.official_email || '-'}</p>
        <p><strong>Contact:</strong> {app.contact_number || '-'}</p>
        <p><strong>Occupation:</strong> {app.occupation || '-'}</p>
        <p><strong>Organization:</strong> {app.organization_name || '-'}</p>
        <p><strong>Portfolio:</strong> {app.portfolio_url || '-'}</p>
        <p><strong>Experience (yrs):</strong> {app.experience_years ?? '-'}</p>
        <p><strong>Location:</strong> {app.location || '-'}</p>
        <p><strong>Date of Birth:</strong> {app.date_of_birth || '-'}</p>
      </>
    )

  return (
    <div className="premium-container fade-in">
      <div style={{ marginBottom: '40px' }}>
        <h1 style={{ fontSize: '32px', marginBottom: '8px', fontFamily: 'var(--font-display)' }}>
          Account Approvals
        </h1>
        <p style={{ color: 'var(--text-secondary)' }}>
          Review pending college and jury applications. No login account exists for an applicant until you
          approve — approving creates the account and emails credentials.
        </p>
      </div>

      {pending.length === 0 ? (
        <div className="glass-card" style={{ textAlign: 'center', padding: '60px 40px', borderLeft: '4px solid var(--success)', marginBottom: '40px' }}>
          <h3 style={{ fontSize: '20px', marginBottom: '8px', color: 'var(--text-primary)' }}>All caught up</h3>
          <p style={{ color: 'var(--text-secondary)' }}>There are no applications currently awaiting review.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '40px' }}>
          {pending.map((app) => (
            <div key={app.id} className="glass-card" style={{ borderLeft: '4px solid var(--warning)', padding: '28px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '20px', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: '280px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                    {app.role === 'college' ? <School size={18} color="var(--primary)" /> : <Gavel size={18} color="var(--primary)" />}
                    <h3 style={{ fontSize: '18px', color: 'var(--text-primary)', textTransform: 'capitalize' }}>
                      {app.role} application
                    </h3>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px', fontSize: '14px', color: 'var(--text-secondary)' }}>
                    {renderFields(app)}
                    <p><strong>Applied:</strong> {new Date(app.created_at).toLocaleDateString()}</p>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                  <button onClick={() => handleAction(app, 'approve')} disabled={processingId === app.id} className="btn btn-success" style={{ padding: '10px 16px' }}>
                    <Check size={16} /> Approve
                  </button>
                  <button onClick={() => handleAction(app, 'request_changes')} disabled={processingId === app.id} className="btn btn-secondary" style={{ padding: '10px 16px', color: 'var(--warning)' }}>
                    <MessageSquareWarning size={16} /> Request Changes
                  </button>
                  <button onClick={() => handleAction(app, 'reject')} disabled={processingId === app.id} className="btn btn-danger" style={{ padding: '10px 16px' }}>
                    <X size={16} /> Reject
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {awaitingApplicant.length > 0 && (
        <>
          <h2 style={{ fontSize: '20px', marginBottom: '16px', fontFamily: 'var(--font-display)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Clock size={20} color="var(--warning)" /> Awaiting Applicant Response
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '20px' }}>
            These applicants were asked to fix something and haven't resubmitted yet. Nothing for you to do here.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {awaitingApplicant.map((app) => (
              <div key={app.id} className="glass-card" style={{ padding: '20px 24px', opacity: 0.85 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
                  <strong style={{ color: 'var(--text-primary)' }}>
                    {app.role === 'college' ? app.college_name : app.full_name} ({app.role})
                  </strong>
                  <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{new Date(app.created_at).toLocaleDateString()}</span>
                </div>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '8px' }}>
                  Note sent: {app.admin_notes}
                </p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
