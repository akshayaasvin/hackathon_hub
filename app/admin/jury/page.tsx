'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Gavel, Mail, User, Trash2, Copy, CheckCircle2 } from 'lucide-react'
import { adminCreateJurySchema } from '@/lib/validation'
import { postJson } from '@/lib/apiFetch'

export default function AdminJuryPage() {
  const [juryList, setJuryList] = useState<any[]>([])
  const [hackathons, setHackathons] = useState<any[]>([])
  const [teams, setTeams] = useState<any[]>([])
  const [assignments, setAssignments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [newCredentials, setNewCredentials] = useState<{ email: string; password: string } | null>(null)
  const [copied, setCopied] = useState(false)

  const [assignHackathonId, setAssignHackathonId] = useState('')
  const [assignTeamId, setAssignTeamId] = useState('')
  const [assignJudgeId, setAssignJudgeId] = useState('')

  const emptyForm = {
    full_name: '',
    contact_number: '',
    email: '',
    official_email: '',
    organization_name: '',
    portfolio_url: '',
    occupation: '',
    experience_years: '',
    location: '',
  }
  const [formData, setFormData] = useState(emptyForm)

  const supabase = createClient()

  useEffect(() => {
    loadAll()
  }, [])

  const loadAll = async () => {
    try {
      setLoading(true)
      const [usersRes, hackathonsRes, teamsRes, assignmentsRes] = await Promise.all([
        supabase.from('users').select('*').eq('role', 'jury'),
        supabase.from('hackathons').select('*').is('deleted_at', null).order('created_at', { ascending: false }),
        supabase.from('teams').select('*'),
        supabase.from('judge_assignments').select('*'),
      ])

      const userList = usersRes.data || []
      const { data: profiles } = userList.length
        ? await supabase.from('jury_profiles').select('*').in('user_id', userList.map((u) => u.id))
        : { data: [] as any[] }

      setJuryList(userList.map((u) => ({ ...u, profile: (profiles || []).find((p) => p.user_id === u.id) || null })))
      setHackathons(hackathonsRes.data || [])
      setTeams(teamsRes.data || [])
      setAssignments(assignmentsRes.data || [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const handleAddJury = async (e: React.FormEvent) => {
    e.preventDefault()
    const parsed = adminCreateJurySchema.safeParse({ role: 'jury', ...formData })
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {}
      for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] = issue.message
      setErrors(fieldErrors)
      return
    }
    setErrors({})
    setActionLoading(true)
    try {
      const result = await postJson<{ email: string; password: string }>('/api/admin/create-account', parsed.data)
      if (!result.success) {
        alert('Error: ' + result.message)
        return
      }
      setFormData(emptyForm)
      setShowAddModal(false)
      if (result.data) {
        setNewCredentials({ email: result.data.email, password: result.data.password })
      }
      await loadAll()
    } finally {
      setActionLoading(false)
    }
  }

  const copyCredentials = async () => {
    if (!newCredentials) return
    await navigator.clipboard.writeText(`Email: ${newCredentials.email}\nPassword: ${newCredentials.password}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleResetPassword = async (userId: string) => {
    setActionLoading(true)
    try {
      const result = await postJson<{ email: string; password: string }>('/api/admin/reset-password', { userId })
      if (!result.success) {
        alert('Error: ' + result.message)
        return
      }
      if (result.data) {
        setNewCredentials({ email: result.data.email, password: result.data.password })
      }
    } finally {
      setActionLoading(false)
    }
  }

  const handleAssign = async () => {
    if (!assignHackathonId || !assignTeamId || !assignJudgeId) {
      alert('Pick a hackathon, team, and jury member first.')
      return
    }
    setActionLoading(true)
    const result = await postJson('/api/admin/judge-assignments', {
      hackathonId: assignHackathonId,
      teamId: assignTeamId,
      judgeId: assignJudgeId,
    })
    if (!result.success) {
      alert('Error: ' + result.message)
    } else {
      setAssignTeamId('')
      setAssignJudgeId('')
      await loadAll()
    }
    setActionLoading(false)
  }

  const handleUnassign = async (id: string) => {
    setActionLoading(true)
    const result = await fetch(`/api/admin/judge-assignments?id=${id}`, { method: 'DELETE' })
      .then((r) => r.json())
      .catch(() => ({ success: false, message: 'Network error.' }))
    if (!result.success) alert('Error: ' + result.message)
    await loadAll()
    setActionLoading(false)
  }

  if (loading) {
    return <div style={{ padding: '100px 20px', textAlign: 'center', fontSize: '18px', color: 'var(--text-secondary)' }}>Loading Jury Panel...</div>
  }

  const teamsForHackathon = teams.filter((t) => t.hackathon_id === assignHackathonId)

  return (
    <div className="premium-container fade-in" style={{ padding: '40px' }}>
      {newCredentials && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div className="glass-card" style={{ maxWidth: '460px', width: '100%', padding: '32px', borderLeft: '4px solid var(--success)' }}>
            <h3 style={{ fontSize: '20px', marginBottom: '8px', color: 'var(--text-primary)' }}>Jury account created</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '20px' }}>
              Share these credentials with the jury member. This is the only time the password is shown — copy it now.
            </p>
            <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '10px', padding: '16px', marginBottom: '20px', fontFamily: 'monospace', fontSize: '14px' }}>
              <div style={{ marginBottom: '8px' }}><strong>Email:</strong> {newCredentials.email}</div>
              <div><strong>Password:</strong> {newCredentials.password}</div>
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button onClick={copyCredentials} className="btn btn-secondary" style={{ padding: '10px 16px' }}>
                {copied ? <CheckCircle2 size={16} /> : <Copy size={16} />} {copied ? 'Copied' : 'Copy'}
              </button>
              <button onClick={() => setNewCredentials(null)} className="btn btn-success" style={{ padding: '10px 16px' }}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px', flexWrap: 'wrap', gap: '20px' }}>
        <div>
          <h1 style={{ fontSize: '32px', marginBottom: '8px', fontFamily: 'var(--font-display)' }}>Jury Panel</h1>
          <p style={{ color: 'var(--text-secondary)' }}>
            Jury who self-registered are approved via Account Approvals. Use "Add Jury Member" to directly
            onboard one, and assign jury to teams below.
          </p>
        </div>
        <button onClick={() => setShowAddModal(true)} className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
          <Plus size={18} /> Add Jury Member
        </button>
      </div>

      <div className="table-container fade-in" style={{ marginBottom: '48px' }}>
        <table className="premium-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Occupation</th>
              <th>Status</th>
              <th>Joined</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {juryList.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>No jury members registered.</td>
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
                  <td>{j.profile?.occupation || '-'}</td>
                  <td>
                    <span style={{ padding: '4px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 600, background: j.status === 'active' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)', color: j.status === 'active' ? 'var(--success)' : 'var(--warning)' }}>
                      {j.status.toUpperCase()}
                    </span>
                  </td>
                  <td>{new Date(j.created_at).toLocaleDateString()}</td>
                  <td>
                    <button
                      onClick={() => handleResetPassword(j.id)}
                      disabled={actionLoading}
                      className="btn btn-secondary"
                      style={{ padding: '6px 12px', fontSize: '13px' }}
                    >
                      Reset Password
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <h2 style={{ fontSize: '22px', marginBottom: '8px', fontFamily: 'var(--font-display)', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Gavel size={20} /> Judge Assignments
      </h2>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '20px' }}>Assign jury members to teams so they only see the submissions they're evaluating.</p>

      <div className="glass-card" style={{ padding: '24px', marginBottom: '24px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '16px' }}>
          <select className="premium-input premium-select" value={assignHackathonId} onChange={(e) => { setAssignHackathonId(e.target.value); setAssignTeamId('') }}>
            <option value="">Select hackathon</option>
            {hackathons.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
          </select>
          <select className="premium-input premium-select" value={assignTeamId} onChange={(e) => setAssignTeamId(e.target.value)} disabled={!assignHackathonId}>
            <option value="">Select team</option>
            {teamsForHackathon.map((t) => <option key={t.id} value={t.id}>{t.team_name}</option>)}
          </select>
          <select className="premium-input premium-select" value={assignJudgeId} onChange={(e) => setAssignJudgeId(e.target.value)}>
            <option value="">Select jury member</option>
            {juryList.filter((j) => j.status === 'active').map((j) => <option key={j.id} value={j.id}>{j.full_name}</option>)}
          </select>
        </div>
        <button onClick={handleAssign} disabled={actionLoading} className="btn btn-primary" style={{ padding: '10px 20px' }}>
          Assign
        </button>
      </div>

      <div className="table-container fade-in">
        <table className="premium-table">
          <thead>
            <tr>
              <th>Hackathon</th>
              <th>Team</th>
              <th>Jury Member</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {assignments.length === 0 ? (
              <tr>
                <td colSpan={4} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>No assignments yet.</td>
              </tr>
            ) : (
              assignments.map((a) => (
                <tr key={a.id}>
                  <td>{hackathons.find((h) => h.id === a.hackathon_id)?.name || '-'}</td>
                  <td>{teams.find((t) => t.id === a.team_id)?.team_name || '-'}</td>
                  <td>{juryList.find((j) => j.id === a.judge_id)?.full_name || '-'}</td>
                  <td>
                    <button onClick={() => handleUnassign(a.id)} className="btn btn-secondary" style={{ padding: '6px 10px', fontSize: '13px', color: 'var(--danger)' }}>
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showAddModal && (
        <div className="modal-overlay">
          <div className="glass-card fade-in" style={{ width: '100%', maxWidth: '640px', padding: '32px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ fontSize: '20px', marginBottom: '8px', fontFamily: 'var(--font-display)' }}>Add Jury Member</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '24px' }}>
              This activates the account immediately — no approval step needed.
            </p>

            <form onSubmit={handleAddJury}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
                {([
                  ['full_name', 'Full Name', 'text'],
                  ['contact_number', 'Contact Number', 'text'],
                  ['email', 'Email ID', 'email'],
                  ['official_email', 'Official Email ID', 'email'],
                  ['organization_name', 'Organization Name', 'text'],
                  ['portfolio_url', 'Portfolio / Website', 'text'],
                  ['occupation', 'Occupation', 'text'],
                  ['experience_years', 'Years of Experience', 'number'],
                  ['location', 'Location', 'text'],
                ] as const).map(([key, label, type]) => (
                  <div key={key}>
                    <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600, fontSize: '13px', color: 'var(--text-secondary)' }}>{label}</label>
                    <input
                      type={type}
                      className="premium-input"
                      value={(formData as any)[key]}
                      onChange={(e) => setFormData({ ...formData, [key]: e.target.value })}
                    />
                    {errors[key] && <div style={{ color: 'var(--danger)', fontSize: '12px', marginTop: '4px' }}>{errors[key]}</div>}
                  </div>
                ))}
              </div>

              <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '24px' }}>
                A secure password is generated automatically and shown once after creation, so you can copy and share it.
              </p>

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
