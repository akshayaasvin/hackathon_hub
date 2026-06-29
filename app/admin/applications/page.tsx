'use client'

import { useState, useEffect } from 'react'
import { createClient } from '../../../lib/supabase/client'
import { FileText, Search, Clock, CheckCircle2, AlertCircle } from 'lucide-react'

export default function AdminApplicationsPage() {
  const [registrations, setRegistrations] = useState<any[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    loadApplications()
  }, [])

  const loadApplications = async () => {
    try {
      setLoading(true)
      const { data: regsData, error: regsError } = await supabase
        .from('registrations')
        .select('*, hackathons!inner(id, name, theme)')
        .order('registered_at', { ascending: false })

      if (regsError) throw regsError

      // Fetch users to join in memory
      const { data: usersData } = await supabase.from('users').select('*')

      const joined = (regsData || []).map(r => {
        const u = (usersData || []).find((usr: any) => usr.id === r.user_id)
        return {
          ...r,
          user: u || { id: r.user_id, email: 'unknown@test.com', full_name: 'Unknown User' }
        }
      })

      setRegistrations(joined)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const filtered = registrations.filter(r => 
    r.user?.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.user?.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.hackathons?.name?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const getStatusBadge = (status: string) => {
    const s = status.toLowerCase()
    if (s === 'confirmed') {
      return <span style={{ background: 'rgba(16, 185, 129, 0.15)', color: 'var(--success)', padding: '4px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}><CheckCircle2 size={12} /> Confirmed</span>
    }
    if (s === 'pending') {
      return <span style={{ background: 'rgba(245, 158, 11, 0.15)', color: 'var(--warning)', padding: '4px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Clock size={12} /> Pending</span>
    }
    return <span style={{ background: 'rgba(239, 68, 68, 0.15)', color: 'var(--danger)', padding: '4px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}><AlertCircle size={12} /> Rejected</span>
  }

  if (loading) {
    return <div style={{ padding: '100px 20px', textAlign: 'center', fontSize: '18px', color: 'var(--text-secondary)' }}>Loading Applications...</div>
  }

  return (
    <div className="premium-container fade-in" style={{ padding: '40px' }}>
      <div style={{ marginBottom: '40px' }}>
        <h1 style={{ fontSize: '32px', marginBottom: '8px', fontFamily: 'var(--font-display)' }}>📋 Student Applications</h1>
        <p style={{ color: 'var(--text-secondary)' }}>View and search all platform hackathon registration records.</p>
      </div>

      <div style={{ marginBottom: '32px', position: 'relative', maxWidth: '480px' }}>
        <input 
          placeholder="Search by student name, email, or hackathon..." 
          value={searchQuery} 
          onChange={(e) => setSearchQuery(e.target.value)}
          className="premium-input"
          style={{ paddingLeft: '44px' }}
        />
        <div style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}>
          <Search size={18} />
        </div>
      </div>

      <div className="table-container fade-in">
        <table className="premium-table">
          <thead>
            <tr>
              <th>Student Name</th>
              <th>Email</th>
              <th>Hackathon</th>
              <th>Status</th>
              <th>Applied Date</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>No applications found.</td>
              </tr>
            ) : (
              filtered.map((r) => (
                <tr key={r.id}>
                  <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{r.user?.full_name || 'N/A'}</td>
                  <td>{r.user?.email}</td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{r.hackathons?.name}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{r.hackathons?.theme}</div>
                  </td>
                  <td>{getStatusBadge(r.registration_status)}</td>
                  <td>{new Date(r.registered_at).toLocaleDateString()}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
