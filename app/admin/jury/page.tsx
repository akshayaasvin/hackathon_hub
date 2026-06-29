'use client'

import { useState, useEffect } from 'react'
import { createClient } from '../../../lib/supabase/client'
import { Plus, Trash2, Gavel, Mail, User } from 'lucide-react'

export default function AdminJuryPage() {
  const [juryList, setJuryList] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const [formData, setFormData] = useState({
    email: '',
    full_name: '',
    password: 'password'
  })

  const supabase = createClient()

  useEffect(() => {
    loadJury()
  }, [])

  const loadJury = async () => {
    try {
      setLoading(true)
      const { data } = await supabase.from('users').select('*')
      const jury = (data || []).filter((u: any) => u && u.role === 'jury' && u.email && u.full_name)
      setJuryList(jury)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const handleAddJury = async (e: React.FormEvent) => {
    e.preventDefault()
    setActionLoading(true)

    const email = formData.email.trim()
    const fullName = formData.full_name.trim()
    const password = formData.password.trim()

    if (!email || !fullName || !password) {
      alert('All fields are required.')
      setActionLoading(false)
      return
    }

    // Insert user into mock store (since NEXT_PUBLIC_MOCK_AUTH is true)
    // We can use supabase.auth.signUp or insert directly into users table
    const { data, error } = await supabase.auth.signUp({
      email: email,
      password: password,
      options: {
        data: {
          full_name: fullName,
          role: 'jury'
        }
      }
    })

    if (error) {
      alert('Error: ' + error.message)
    } else {
      // Also insert into users table just in case
      await supabase.from('users').insert({
        id: data.user?.id || Math.random().toString(36).substring(2, 9),
        email: email,
        full_name: fullName,
        role: 'jury',
        created_at: new Date().toISOString()
      })
      alert('Jury member created successfully!')
      setFormData({ email: '', full_name: '', password: 'password' })
      setShowAddModal(false)
      loadJury()
    }
    setActionLoading(false)
  }

  const handleDeleteJury = async (juryId: string) => {
    if (!confirm('Are you sure you want to remove this jury member?')) return
    setActionLoading(true)
    const { error } = await supabase.from('users').delete().eq('id', juryId)
    if (error) {
      alert('Error: ' + error.message)
    } else {
      alert('Jury member removed successfully!')
      loadJury()
    }
    setActionLoading(false)
  }

  if (loading) {
    return <div style={{ padding: '100px 20px', textAlign: 'center', fontSize: '18px', color: 'var(--text-secondary)' }}>Loading Jury Panel...</div>
  }

  return (
    <div className="premium-container fade-in" style={{ padding: '40px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px', flexWrap: 'wrap', gap: '20px' }}>
        <div>
          <h1 style={{ fontSize: '32px', marginBottom: '8px', fontFamily: 'var(--font-display)' }}>⚖️ Jury Panel</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Manage hackathon jury members, promote users, and audit grading permissions.</p>
        </div>
        <button onClick={() => setShowAddModal(true)} className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
          <Plus size={18} /> Add Jury Member
        </button>
      </div>

      {/* Jury List Table */}
      <div className="table-container fade-in">
        <table className="premium-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Joined Date</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {juryList.length === 0 ? (
              <tr>
                <td colSpan={4} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>No jury members registered.</td>
              </tr>
            ) : (
              juryList.map((j) => (
                <tr key={j.id}>
                  <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ background: 'rgba(236, 72, 153, 0.1)', padding: '6px', borderRadius: '8px', color: '#db2777' }}>
                        <User size={16} />
                      </div>
                      {j.full_name}
                    </div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Mail size={14} color="var(--text-secondary)" />
                      {j.email}
                    </div>
                  </td>
                  <td>{j.created_at && !isNaN(Date.parse(j.created_at)) ? new Date(j.created_at).toLocaleDateString() : 'N/A'}</td>
                  <td>
                    <button onClick={() => handleDeleteJury(j.id)} className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '13px', color: 'var(--danger)', borderColor: 'rgba(239,68,68,0.2)' }} title="Remove Panel Access">
                      <Trash2 size={14} style={{ display: 'inline', marginRight: '4px' }} /> Remove
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Add Jury Modal */}
      {showAddModal && (
        <div className="modal-overlay">
          <div className="glass-card fade-in" style={{ width: '100%', maxWidth: '440px', padding: '32px' }}>
            <h2 style={{ fontSize: '20px', marginBottom: '8px', fontFamily: 'var(--font-display)' }}>Add Jury Member</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '24px' }}>Register a new judge account with evaluation permissions.</p>

            <form onSubmit={handleAddJury}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600, fontSize: '13px', color: 'var(--text-secondary)' }}>Full Name *</label>
                  <input 
                    value={formData.full_name} 
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })} 
                    required 
                    className="premium-input"
                    placeholder="e.g. Dr. John Doe"
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600, fontSize: '13px', color: 'var(--text-secondary)' }}>Email Address *</label>
                  <input 
                    type="email"
                    value={formData.email} 
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })} 
                    required 
                    className="premium-input"
                    placeholder="e.g. judge@test.com"
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600, fontSize: '13px', color: 'var(--text-secondary)' }}>Password *</label>
                  <input 
                    type="password"
                    value={formData.password} 
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })} 
                    required 
                    className="premium-input"
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setShowAddModal(false)} className="btn btn-secondary" style={{ padding: '8px 16px' }}>Cancel</button>
                <button type="submit" disabled={actionLoading} className="btn btn-primary" style={{ padding: '8px 24px' }}>
                  {actionLoading ? 'Creating...' : 'Register Judge'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
