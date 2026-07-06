'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { postJson } from '@/lib/apiFetch'
import { Users, Search, Mail, Download, Trash2 } from 'lucide-react'

export default function AdminUsersPage() {
  const [users, setUsers] = useState<any[]>([])
  const [profileByUserId, setProfileByUserId] = useState<Map<string, { college_name?: string; date_of_birth?: string }>>(new Map())
  const [hackathons, setHackathons] = useState<any[]>([])
  const [registeredUserIdsByHackathon, setRegisteredUserIdsByHackathon] = useState<Map<string, Set<string>>>(new Map())

  const [searchQuery, setSearchQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [hackathonFilter, setHackathonFilter] = useState('all')

  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    loadUsers()
  }, [])

  const loadUsers = async () => {
    try {
      setLoading(true)

      const [usersRes, participantRes, collegeRes, hackathonsRes, registrationsRes] = await Promise.all([
        supabase.from('users').select('*'),
        supabase.from('participant_profiles').select('user_id, college_name, date_of_birth'),
        supabase.from('college_profiles').select('user_id, college_name'),
        supabase.from('hackathons').select('id, name').order('created_at', { ascending: false }),
        supabase.from('registrations').select('user_id, hackathon_id'),
      ])

      setUsers(usersRes.data || [])
      setHackathons(hackathonsRes.data || [])

      const profiles = new Map<string, { college_name?: string; date_of_birth?: string }>()
      for (const p of participantRes.data || []) {
        profiles.set(p.user_id, { college_name: p.college_name, date_of_birth: p.date_of_birth })
      }
      for (const c of collegeRes.data || []) {
        profiles.set(c.user_id, { college_name: c.college_name })
      }
      setProfileByUserId(profiles)

      const byHackathon = new Map<string, Set<string>>()
      for (const r of registrationsRes.data || []) {
        if (!byHackathon.has(r.hackathon_id)) byHackathon.set(r.hackathon_id, new Set())
        byHackathon.get(r.hackathon_id)!.add(r.user_id)
      }
      setRegisteredUserIdsByHackathon(byHackathon)
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

  const handleDelete = async (u: any) => {
    const confirmed = confirm(
      `Delete ${u.full_name || u.email}? This permanently removes their account, profile, registrations, and submissions. This cannot be undone.`
    )
    if (!confirmed) return

    setDeletingId(u.id)
    const result = await postJson('/api/admin/delete-user', { userId: u.id })
    if (!result.success) {
      alert('Error: ' + result.message)
    } else {
      setUsers((prev) => prev.filter((x) => x.id !== u.id))
    }
    setDeletingId(null)
  }

  const filtered = useMemo(() => {
    return users.filter((u) => {
      const matchesSearch =
        u.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.role?.toLowerCase().includes(searchQuery.toLowerCase())

      const matchesRole = roleFilter === 'all' || u.role === roleFilter
      const matchesStatus = statusFilter === 'all' || u.status === statusFilter
      const matchesHackathon =
        hackathonFilter === 'all' || registeredUserIdsByHackathon.get(hackathonFilter)?.has(u.id)

      return matchesSearch && matchesRole && matchesStatus && matchesHackathon
    })
  }, [users, searchQuery, roleFilter, statusFilter, hackathonFilter, registeredUserIdsByHackathon])

  const getRoleBadgeColor = (role: string) => {
    const r = role.toLowerCase()
    if (r === 'admin') return { bg: 'rgba(239, 68, 68, 0.15)', text: 'var(--danger)' }
    if (r === 'jury') return { bg: 'rgba(168, 85, 247, 0.15)', text: 'var(--secondary)' }
    if (r === 'college') return { bg: 'rgba(6, 182, 212, 0.15)', text: '#0891b2' }
    return { bg: 'rgba(99, 102, 241, 0.15)', text: 'var(--primary)' }
  }

  const exportCsv = () => {
    const header = ['Name', 'Email', 'Role', 'Institution/College', 'Status', 'Registration Date', 'Date of Birth']
    const escape = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`

    const rows = filtered.map((u) => {
      const profile = profileByUserId.get(u.id)
      return [
        u.full_name || '',
        u.email || '',
        u.role || '',
        profile?.college_name || '',
        u.status || '',
        u.created_at ? new Date(u.created_at).toLocaleDateString() : '',
        u.role === 'participant' ? profile?.date_of_birth || '' : '',
      ]
    })

    const csv = [header, ...rows].map((row) => row.map(escape).join(',')).join('\r\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `users-export-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (loading) {
    return <div style={{ padding: '100px 20px', textAlign: 'center', fontSize: '18px', color: 'var(--text-secondary)' }}>Loading Users...</div>
  }

  return (
    <div className="premium-container fade-in" style={{ padding: '40px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '20px', flexWrap: 'wrap', marginBottom: '32px' }}>
        <div>
          <h1 style={{ fontSize: '32px', marginBottom: '8px', fontFamily: 'var(--font-display)' }}>
            <Users size={28} style={{ verticalAlign: 'middle', marginRight: '10px' }} />
            User Account Audits
          </h1>
          <p style={{ color: 'var(--text-secondary)' }}>Audit active platform accounts, filter by role/status/hackathon, export, or remove accounts.</p>
        </div>
        <button onClick={exportCsv} className="btn btn-secondary" style={{ padding: '10px 18px' }}>
          <Download size={16} /> Export CSV ({filtered.length})
        </button>
      </div>

      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '32px' }}>
        <div style={{ position: 'relative', flex: '1 1 260px', minWidth: '220px' }}>
          <input
            placeholder="Search by name, email, or role..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="premium-input"
            style={{ paddingLeft: '44px' }}
          />
          <div style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}>
            <Search size={18} />
          </div>
        </div>

        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="premium-input premium-select"
          style={{ minWidth: '160px' }}
        >
          <option value="all">All Roles</option>
          <option value="participant">Participant</option>
          <option value="college">Institution</option>
          <option value="jury">Jury</option>
          <option value="admin">Admin</option>
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="premium-input premium-select"
          style={{ minWidth: '160px' }}
        >
          <option value="all">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="active">Active</option>
          <option value="rejected">Rejected</option>
        </select>

        <select
          value={hackathonFilter}
          onChange={(e) => setHackathonFilter(e.target.value)}
          className="premium-input premium-select"
          style={{ minWidth: '200px' }}
        >
          <option value="all">All Hackathons</option>
          {hackathons.map((h) => (
            <option key={h.id} value={h.id}>{h.name}</option>
          ))}
        </select>
      </div>

      <div className="table-container fade-in">
        <table className="premium-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Institution/College</th>
              <th>Status</th>
              <th>Modify Role</th>
              <th>Delete</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>No users found.</td>
              </tr>
            ) : (
              filtered.map((u) => {
                const badge = getRoleBadgeColor(u.role)
                const profile = profileByUserId.get(u.id)
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
                    <td style={{ color: 'var(--text-secondary)' }}>{profile?.college_name || '-'}</td>
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
                    <td>
                      <button
                        onClick={() => handleDelete(u)}
                        disabled={deletingId === u.id}
                        className="btn btn-secondary"
                        style={{ padding: '6px 12px', fontSize: '13px', color: 'var(--danger)', borderColor: 'rgba(239, 68, 68, 0.3)' }}
                      >
                        <Trash2 size={14} /> {deletingId === u.id ? 'Deleting...' : 'Delete'}
                      </button>
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
