'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../../lib/supabase/client'
import { Check, X, ShieldAlert, Award, School } from 'lucide-react'

export default function AdminApprovalsPage() {
  const [user, setUser] = useState<any>(null)
  const [pendingRegistrations, setPendingRegistrations] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
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

      const { data: userData } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single()

      if (userData?.role !== 'admin') {
        router.push('/participant')
        return
      }

      setUser(user)
      await loadPendingRegistrations()
      
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadPendingRegistrations = async () => {
    try {
      const { data: registrationsData, error: regError } = await supabase
        .from('registrations')
        .select(`
          *,
          hackathons!inner(id, name, theme, registration_fee)
        `)
        .eq('registration_status', 'pending')
        .order('registered_at', { ascending: false })

      if (regError) {
        console.error('Error fetching registrations:', regError)
        return
      }

      // Fetch all users (this queries the mock store under mock auth)
      const { data: usersData, error: usersError } = await supabase
        .from('users')
        .select('*')

      const joined = (registrationsData || []).map(reg => {
        const u = (usersData || []).find((usr: any) => usr.id === reg.user_id)
        return {
          ...reg,
          users: u || { id: reg.user_id, email: 'unknown@test.com', full_name: 'Unknown User' }
        }
      })

      setPendingRegistrations(joined)
    } catch (err) {
      console.error('Error in loadPendingRegistrations:', err)
    }
  }

  const handleApprove = async (registrationId: string) => {
    setProcessing(true)
    
    const { error } = await supabase
      .from('registrations')
      .update({ registration_status: 'confirmed' })
      .eq('id', registrationId)

    if (error) {
      alert('Error: ' + error.message)
    } else {
      alert('Registration approved!')
      await loadPendingRegistrations()
    }
    const { data } = await supabase
      .from('registrations')
      .select('user_id, hackathon_id')
      .eq('id', registrationId)
      .single()
    if (data) {
      await supabase.from('notifications').insert({
        user_id: data.user_id,
        title: 'Registration Approved!',
        message: 'Your registration application was approved by the administrator.',
        type: 'approval',
        link: '/participant'
      })
    }
    setProcessing(false)
  }

  const handleReject = async (registrationId: string) => {
    const reason = prompt('Enter rejection reason (optional):')
    
    setProcessing(true)
    
    const { error } = await supabase
      .from('registrations')
      .update({ 
        registration_status: 'rejected',
        notes: reason || 'No reason provided'
      })
      .eq('id', registrationId)

    if (error) {
      alert('Error: ' + error.message)
    } else {
      alert('Registration rejected!')
      await loadPendingRegistrations()
    }
    const { data } = await supabase
      .from('registrations')
      .select('user_id, hackathon_id')
      .eq('id', registrationId)
      .single()
    if (data) {
      await supabase.from('notifications').insert({
        user_id: data.user_id,
        title: 'Registration Rejected',
        message: `Your registration application was rejected. Reason: ${reason || 'No reason provided'}`,
        type: 'rejection',
        link: '/participant'
      })
    }
    setProcessing(false)
  }

  if (loading) {
    return <div style={{ padding: '100px 20px', textAlign: 'center', fontSize: '18px', color: 'var(--text-secondary)' }}>Loading Approvals Panel...</div>
  }

  return (
    <div className="premium-container fade-in">
      <div style={{ marginBottom: '40px' }}>
        <h1 style={{ fontSize: '32px', marginBottom: '8px', fontFamily: 'var(--font-display)' }}>🛡️ Registration Approvals</h1>
        <p style={{ color: 'var(--text-secondary)' }}>Audit registration applications, verify credentials, and approve student participations.</p>
      </div>

      {pendingRegistrations.length === 0 ? (
        <div className="glass-card" style={{ 
          textAlign: 'center', 
          padding: '60px 40px', 
          borderLeft: '4px solid var(--success)',
          marginTop: '30px'
        }}>
          <h3 style={{ fontSize: '20px', marginBottom: '8px', color: 'var(--text-primary)' }}>✅ All Caught Up!</h3>
          <p style={{ color: 'var(--text-secondary)' }}>There are no registration applications currently awaiting approval.</p>
        </div>
      ) : (
        <div style={{ marginTop: '30px' }}>
          <h3 style={{ fontSize: '18px', marginBottom: '20px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            Applications Pending Review: <span style={{ color: 'var(--warning)', fontWeight: 700 }}>{pendingRegistrations.length}</span>
          </h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {pendingRegistrations.map((reg) => (
              <div key={reg.id} className="glass-card" style={{ 
                borderLeft: '4px solid var(--warning)',
                padding: '28px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '20px', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: '280px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                      <Award size={18} color="var(--primary)" />
                      <h3 style={{ fontSize: '18px', color: 'var(--text-primary)' }}>{reg.hackathons?.name}</h3>
                    </div>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', fontSize: '14px', color: 'var(--text-secondary)' }}>
                      <p><strong>Full Name:</strong> <span style={{ color: 'var(--text-primary)' }}>{reg.users?.full_name || reg.users?.email}</span></p>
                      <p><strong>Email:</strong> <span style={{ color: 'var(--text-primary)' }}>{reg.users?.email}</span></p>
                      <p><strong>Phone:</strong> {reg.users?.phone || '-'}</p>
                      <p><strong>College/University:</strong> {reg.users?.college_name || '-'}</p>
                      <p><strong>Branch/Dept:</strong> {reg.users?.department || '-'}</p>
                      <p><strong>Year of Study:</strong> {reg.users?.year_of_study || '-'}</p>
                      <p><strong>Registration Fee:</strong> <span style={{ color: reg.hackathons?.registration_fee > 0 ? 'var(--warning)' : 'var(--success)' }}>{reg.hackathons?.registration_fee > 0 ? `$${reg.hackathons?.registration_fee}` : 'Free'}</span></p>
                      <p><strong>Applied Date:</strong> {new Date(reg.registered_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <button
                      onClick={() => handleApprove(reg.id)}
                      disabled={processing}
                      className="btn btn-success"
                      style={{ padding: '10px 18px' }}
                    >
                      <Check size={16} /> Approve
                    </button>
                    <button
                      onClick={() => handleReject(reg.id)}
                      disabled={processing}
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
        </div>
      )}
    </div>
  )
}