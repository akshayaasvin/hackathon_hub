'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Users, Search, Mail, ShieldAlert, Award, School } from 'lucide-react'

export default function AdminUsersPage() {
  const [users, setUsers] = useState<any[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    loadUsers()
  }, [])

  const loadUsers = async () => {
    try {
      setLoading(true)
      const { data } = await supabase.from('users').select('*')
      setUsers(data || [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const handleRoleChange = async (userId: string, newRole: string) => {
    setActionLoading(true)
    const { error } = await supabase
      .from('users')
      .update({ role: newRole })
      .eq('id', userId)

    if (error) {
      alert('Error updating role: ' + error.message)
    } else {
      alert('User role updated successfully!')
      loadUsers()
    }
    setActionLoading(false)
  }

  const filtered = users.filter(u => 
    u.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.role?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const getRoleBadgeColor = (role: string) => {
    const r = role.toLowerCase()
    if (r === 'admin') return { bg: 'rgba(239, 68, 68, 0.15)', text: 'var(--danger)' }
    if (r === 'jury') return { bg: 'rgba(168, 85, 247, 0.15)', text: 'var(--secondary)' }
    if (r === 'college') return { bg: 'rgba(6, 182, 212, 0.15)', text: '#0891b2' }
    return { bg: 'rgba(99, 102, 241, 0.15)', text: 'var(--primary)' }
  }

  if (loading) {
    return <div style={{ padding: '100px 20px', textAlign: 'center', fontSize: '18px', color: 'var(--text-secondary)' }}>Loading Users...</div>
  }

  return (
    <div className="premium-container fade-in" style={{ padding: '40px' }}>
      <div style={{ marginBottom: '40px' }}>
        <h1 style={{ fontSize: '32px', marginBottom: '8px', fontFamily: 'var(--font-display)' }}>👥 User Account Audits</h1>
        <p style={{ color: 'var(--text-secondary)' }}>Audit active platform accounts, view registration metadata and modify user roles.</p>
      </div>

      <div style={{ marginBottom: '32px', position: 'relative', maxWidth: '480px' }}>
        <input 
          placeholder="Search users by name, email, or role..." 
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
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Status</th>
              <th>Modify Role</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>No users found.</td>
              </tr>
            ) : (
              filtered.map((u) => {
                const badge = getRoleBadgeColor(u.role)
                return (
                  <tr key={u.id}>
                    <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{u.full_name || 'Participant'}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Mail size={14} color="var(--text-secondary)" />
                        {u.email}
                      </div>
                    </td>
                    <td>
                      <span style={{
                        padding: '4px 10px',
                        borderRadius: '20px',
                        fontSize: '12px',
                        fontWeight: 600,
                        background: badge.bg,
                        color: badge.text
                      }}>
                        {u.role ? u.role.toUpperCase() : 'PARTICIPANT'}
                      </span>
                    </td>
                    <td style={{ textTransform: 'capitalize', color: 'var(--text-secondary)' }}>{u.status || '-'}</td>
                    <td>
                      <select
                        value={u.role || 'participant'} 
                        onChange={(e) => handleRoleChange(u.id, e.target.value)}
                        disabled={actionLoading}
                        className="premium-input premium-select"
                        style={{ width: '160px', padding: '6px 12px', fontSize: '13px' }}
                      >
                        <option value="participant">Participant</option>
                        <option value="jury">Jury</option>
                        <option value="college">College</option>
                        <option value="admin">Admin</option>
                      </select>
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
