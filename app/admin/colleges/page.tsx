'use client'

import React, { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Search, Eye, X, Trophy, Users, BookOpen, TrendingUp, Copy, CheckCircle2 } from 'lucide-react'
import { adminCreateCollegeSchema } from '@/lib/validation'
import { postJson } from '@/lib/apiFetch'

export default function AdminCollegesPage() {
  const [colleges, setColleges] = useState<any[]>([])
  const [participants, setParticipants] = useState<any[]>([])
  const [teamMembers, setTeamMembers] = useState<any[]>([])
  const [evaluations, setEvaluations] = useState<any[]>([])
  const [hackathons, setHackathons] = useState<any[]>([])
  const [registrations, setRegistrations] = useState<any[]>([])
  const [teams, setTeams] = useState<any[]>([])
  const [submissions, setSubmissions] = useState<any[]>([])
  const [selectedHackathonId, setSelectedHackathonId] = useState('')

  const [searchQuery, setSearchQuery] = useState('')
  const [studentSearchQuery, setStudentSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [showFormModal, setShowFormModal] = useState(false)
  const [selectedCollege, setSelectedCollege] = useState<any>(null)
  const [showDetailsModal, setShowDetailsModal] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [newCredentials, setNewCredentials] = useState<{ email: string; password: string } | null>(null)
  const [copied, setCopied] = useState(false)

  const emptyForm = {
    college_name: '',
    representative_name: '',
    position_in_college: '',
    official_email: '',
    personal_email: '',
    contact_number: '',
    department: '',
    college_address: '',
  }
  const [formData, setFormData] = useState(emptyForm)

  const supabase = createClient()

  useEffect(() => {
    loadColleges()
  }, [])

  const loadColleges = async () => {
    try {
      setLoading(true)
      const [usersRes, participantsRes, teamMembersRes, evaluationsRes, hackathonsRes, registrationsRes, teamsRes, submissionsRes] = await Promise.all([
        supabase.from('users').select('*').eq('role', 'college'),
        supabase.from('participant_profiles').select('*'),
        supabase.from('team_members').select('*'),
        supabase.from('evaluations').select('*'),
        supabase.from('hackathons').select('id, name').is('deleted_at', null).order('created_at', { ascending: false }),
        supabase.from('registrations').select('hackathon_id, user_id'),
        supabase.from('teams').select('id, hackathon_id'),
        supabase.from('submissions').select('id, team_id'),
      ])
      setHackathons(hackathonsRes.data || [])
      setRegistrations(registrationsRes.data || [])
      setTeams(teamsRes.data || [])
      setSubmissions(submissionsRes.data || [])

      const userList = usersRes.data || []
      const { data: profiles } = userList.length
        ? await supabase.from('college_profiles').select('*').in('user_id', userList.map((u) => u.id))
        : { data: [] as any[] }

      const merged = userList.map((u) => ({
        ...u,
        profile: (profiles || []).find((p) => p.user_id === u.id) || null,
      }))

      setColleges(merged)
      setParticipants(participantsRes.data || [])
      setTeamMembers(teamMembersRes.data || [])
      setEvaluations(evaluationsRes.data || [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const handleOpenCreate = () => {
    setFormData(emptyForm)
    setErrors({})
    setShowFormModal(true)
  }

  const handleOpenDetails = (college: any) => {
    setSelectedCollege(college)
    setStudentSearchQuery('')
    setShowDetailsModal(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const parsed = adminCreateCollegeSchema.safeParse({ role: 'college', ...formData })
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
      setShowFormModal(false)
      if (result.data) {
        setNewCredentials({ email: result.data.email, password: result.data.password })
      }
      await loadColleges()
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

  const getStudentDetails = (student: any) => {
    const member = teamMembers.find((tm: any) => tm.user_id === student.user_id)
    const teamId = member?.team_id
    const teamEval = teamId ? evaluations.find((e: any) => e.team_id === teamId) : null
    return {
      ...student,
      hasTeam: !!teamId,
      score: teamEval?.total_score || 0,
    }
  }

  const getCollegesLeaderboard = () => {
    const leaderboard = colleges.map((col) => {
      const collegeName = col.profile?.college_name
      const colStudents = participants.filter((s: any) => s.college_name === collegeName)
      const participantCount = colStudents.length
      const totalScore = colStudents.reduce((sum: number, stud: any) => {
        const member = teamMembers.find((tm: any) => tm.user_id === stud.user_id)
        if (member) {
          const teamEval = evaluations.find((e: any) => e.team_id === member.team_id)
          return sum + (teamEval ? teamEval.total_score || 0 : 0)
        }
        return sum
      }, 0)
      return { ...col, participantCount, totalScore }
    })

    return [...leaderboard]
      .sort((a, b) => (b.participantCount !== a.participantCount ? b.participantCount - a.participantCount : b.totalScore - a.totalScore))
      .slice(0, 3)
  }

  const getHackathonScopedStats = () => {
    if (!selectedHackathonId) return []

    const regsForHackathon = registrations.filter((r) => r.hackathon_id === selectedHackathonId)
    const registeredUserIds = new Set(regsForHackathon.map((r) => r.user_id))
    const teamsForHackathon = teams.filter((t) => t.hackathon_id === selectedHackathonId)
    const teamIdsForHackathon = new Set(teamsForHackathon.map((t) => t.id))
    const submissionsForHackathon = submissions.filter((s) => teamIdsForHackathon.has(s.team_id))

    return colleges.map((col) => {
      const collegeName = col.profile?.college_name
      const collegeStudentUserIds = new Set(
        participants.filter((p) => p.college_name === collegeName).map((p) => p.user_id)
      )

      const registeredCount = [...registeredUserIds].filter((uid) => collegeStudentUserIds.has(uid)).length

      const collegeTeamIds = new Set(
        teamsForHackathon
          .filter((t) => teamMembers.some((tm) => tm.team_id === t.id && collegeStudentUserIds.has(tm.user_id)))
          .map((t) => t.id)
      )

      const submissionsCount = submissionsForHackathon.filter((s) => collegeTeamIds.has(s.team_id)).length

      return {
        ...col,
        registeredCount,
        teamsCount: collegeTeamIds.size,
        submissionsCount,
      }
    })
  }

  const hackathonScopedStats = getHackathonScopedStats()

  const sortedColleges = [...colleges].sort((a, b) =>
    (a.profile?.college_name || '').localeCompare(b.profile?.college_name || '')
  )

  const filteredColleges = sortedColleges.filter(
    (col) =>
      (col.profile?.college_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      col.email.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const top3Colleges = getCollegesLeaderboard()

  if (loading) {
    return <div style={{ padding: '100px 20px', textAlign: 'center', fontSize: '18px', color: 'var(--text-secondary)' }}>Loading Colleges...</div>
  }

  return (
    <div className="premium-container fade-in" style={{ padding: '40px' }}>
      {newCredentials && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div className="glass-card" style={{ maxWidth: '460px', width: '100%', padding: '32px', borderLeft: '4px solid var(--success)' }}>
            <h3 style={{ fontSize: '20px', marginBottom: '8px', color: 'var(--text-primary)' }}>College account created</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '20px' }}>
              Share these credentials with the college. This is the only time the password is shown — copy it now.
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
          <h1 style={{ fontSize: '32px', marginBottom: '8px', fontFamily: 'var(--font-display)' }}>College Management</h1>
          <p style={{ color: 'var(--text-secondary)' }}>
            Colleges that self-registered are approved via Account Approvals. Use "Create College" to
            directly onboard one without self-registration.
          </p>
        </div>
        <button onClick={handleOpenCreate} className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
          <Plus size={18} /> Create College
        </button>
      </div>

      <div className="glass-card" style={{ padding: '24px', marginBottom: '40px' }}>
        <h2 style={{ fontSize: '20px', marginBottom: '8px', fontFamily: 'var(--font-display)' }}>Hackathon Participation</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '16px' }}>
          Pick a hackathon to see each college's registrations, teams, and submissions for that event specifically.
        </p>
        <select
          className="premium-input premium-select"
          style={{ maxWidth: '320px', marginBottom: selectedHackathonId ? '20px' : 0 }}
          value={selectedHackathonId}
          onChange={(e) => setSelectedHackathonId(e.target.value)}
        >
          <option value="">Select a hackathon</option>
          {hackathons.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
        </select>

        {selectedHackathonId && (
          <div className="table-container">
            <table className="premium-table">
              <thead>
                <tr>
                  <th>College Name</th>
                  <th>Registered Students</th>
                  <th>Teams Formed</th>
                  <th>Submissions</th>
                </tr>
              </thead>
              <tbody>
                {hackathonScopedStats.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-secondary)' }}>No colleges found.</td>
                  </tr>
                ) : (
                  hackathonScopedStats.map((col) => (
                    <tr key={col.id}>
                      <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{col.profile?.college_name || '-'}</td>
                      <td>{col.registeredCount}</td>
                      <td>{col.teamsCount}</td>
                      <td>{col.submissionsCount}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {top3Colleges.length > 0 && (
        <>
          <h2 style={{ fontSize: '22px', marginBottom: '20px', fontFamily: 'var(--font-display)' }}>Top Performing Colleges</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px', marginBottom: '40px' }}>
            {top3Colleges.map((col: any, idx: number) => {
              const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉'
              return (
                <div key={col.id} className="glass-card fade-in" style={{ padding: '24px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                    <span style={{ fontSize: '32px' }}>{medal}</span>
                    <div>
                      <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)' }}>{col.profile?.college_name}</h3>
                      <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Rank {idx + 1}</p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(0,0,0,0.05)', paddingTop: '12px', fontSize: '14px', color: 'var(--text-secondary)' }}>
                    <span><strong>Participants:</strong> {col.participantCount}</span>
                    <span><strong>Total Score:</strong> {col.totalScore}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      <div style={{ marginBottom: '32px', position: 'relative', maxWidth: '480px' }}>
        <input
          placeholder="Search colleges by name or email..."
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
              <th>College Name</th>
              <th>Representative</th>
              <th>Login Email</th>
              <th>Status</th>
              <th>Registered</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredColleges.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>No colleges found.</td>
              </tr>
            ) : (
              filteredColleges.map((col) => (
                <tr key={col.id}>
                  <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{col.profile?.college_name || '-'}</td>
                  <td>{col.profile?.representative_name || '-'}</td>
                  <td>{col.email}</td>
                  <td>
                    <span
                      style={{
                        padding: '4px 10px',
                        borderRadius: '20px',
                        fontSize: '12px',
                        fontWeight: 600,
                        background: col.status === 'active' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                        color: col.status === 'active' ? 'var(--success)' : 'var(--warning)',
                      }}
                    >
                      {col.status.toUpperCase()}
                    </span>
                  </td>
                  <td>{new Date(col.created_at).toLocaleDateString()}</td>
                  <td>
                    <button onClick={() => handleOpenDetails(col)} className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '13px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <Eye size={14} /> <span>View Students</span>
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showFormModal && (
        <div className="modal-overlay">
          <div className="glass-card fade-in" style={{ width: '100%', maxWidth: '640px', padding: '32px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ fontSize: '22px', marginBottom: '8px', fontFamily: 'var(--font-display)' }}>Create College Account</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '24px' }}>
              This activates the account immediately — no approval step needed.
            </p>

            <form onSubmit={handleSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '16px' }}>
                {([
                  ['college_name', 'College Name', 'text'],
                  ['representative_name', "Representative's Name", 'text'],
                  ['position_in_college', 'Position in College', 'text'],
                  ['official_email', 'Official (Work) Email', 'email'],
                  ['personal_email', 'Personal Email', 'email'],
                  ['contact_number', 'Contact Number', 'text'],
                  ['department', 'Department', 'text'],
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

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600, fontSize: '13px', color: 'var(--text-secondary)' }}>College Address</label>
                <input
                  className="premium-input"
                  value={formData.college_address}
                  onChange={(e) => setFormData({ ...formData, college_address: e.target.value })}
                />
                {errors.college_address && <div style={{ color: 'var(--danger)', fontSize: '12px', marginTop: '4px' }}>{errors.college_address}</div>}
              </div>

              <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '24px' }}>
                A secure password is generated automatically and shown once after creation, so you can copy and share it.
              </p>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setShowFormModal(false)} className="btn btn-secondary" style={{ padding: '8px 20px' }}>Cancel</button>
                <button type="submit" disabled={actionLoading} className="btn btn-primary" style={{ padding: '8px 24px' }}>
                  {actionLoading ? 'Creating...' : 'Create College'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showDetailsModal && selectedCollege && (() => {
        const collegeName = selectedCollege.profile?.college_name
        const collegeStudents = participants.filter((s: any) => s.college_name === collegeName)
        const formattedStudents = collegeStudents.map(getStudentDetails)
        const filteredStudents = formattedStudents.filter((s: any) =>
          (s.user_id || '').toLowerCase().includes(studentSearchQuery.toLowerCase()) ||
          (s.degree || '').toLowerCase().includes(studentSearchQuery.toLowerCase()) ||
          (s.domain || '').toLowerCase().includes(studentSearchQuery.toLowerCase())
        )
        const totalStuds = formattedStudents.length
        const teamsFormed = formattedStudents.filter((s: any) => s.hasTeam).length
        const scores = formattedStudents.map((s) => s.score)
        const avgScore = scores.length > 0 ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1) : '0'
        const maxScore = scores.length > 0 ? Math.max(...scores) : 0

        return (
          <div className="modal-overlay" style={{ zIndex: 1100 }}>
            <div className="glass-card fade-in" style={{ width: '95%', maxWidth: '1000px', padding: '32px', maxHeight: '90vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h2 style={{ fontSize: '24px', fontFamily: 'var(--font-display)', marginBottom: '4px' }}>{collegeName}</h2>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>{selectedCollege.email}</p>
                </div>
                <button onClick={() => setShowDetailsModal(false)} className="btn btn-secondary" style={{ padding: '8px 12px' }}>
                  <X size={18} />
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' }}>
                <div className="glass-card stat-card-gradient" style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '16px 20px' }}>
                  <Users size={20} color="var(--primary)" />
                  <div><h4 style={{ fontSize: '20px' }}>{totalStuds}</h4><p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Total Students</p></div>
                </div>
                <div className="glass-card stat-card-gradient" style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '16px 20px' }}>
                  <TrendingUp size={20} color="var(--success)" />
                  <div><h4 style={{ fontSize: '20px' }}>{teamsFormed}</h4><p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Teams Formed</p></div>
                </div>
                <div className="glass-card stat-card-gradient" style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '16px 20px' }}>
                  <TrendingUp size={20} color="var(--secondary)" />
                  <div><h4 style={{ fontSize: '20px' }}>{avgScore}</h4><p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Average Score</p></div>
                </div>
                <div className="glass-card stat-card-gradient" style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '16px 20px' }}>
                  <Trophy size={20} color="var(--warning)" />
                  <div><h4 style={{ fontSize: '20px' }}>{maxScore}</h4><p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Highest Score</p></div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', borderTop: '1px solid var(--border-color)', paddingTop: '20px' }}>
                <h3 style={{ fontSize: '18px', fontFamily: 'var(--font-display)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <BookOpen size={18} color="var(--primary)" /> Student Directory
                </h3>
                {totalStuds > 0 && (
                  <input
                    placeholder="Search by degree or domain..."
                    value={studentSearchQuery}
                    onChange={(e) => setStudentSearchQuery(e.target.value)}
                    className="premium-input"
                    style={{ maxWidth: '280px', fontSize: '14px' }}
                  />
                )}
              </div>

              {totalStuds === 0 ? (
                <div style={{ textAlign: 'center', padding: '48px 24px', border: '2px dashed var(--border-color)', borderRadius: '16px' }}>
                  <p style={{ color: 'var(--text-secondary)' }}>No students registered from this college yet.</p>
                </div>
              ) : (
                <div className="table-container">
                  <table className="premium-table" style={{ fontSize: '14px' }}>
                    <thead>
                      <tr>
                        <th>Degree</th>
                        <th>Domain</th>
                        <th>Passout Year</th>
                        <th>Experience</th>
                        <th>Contact</th>
                        <th>Team Status</th>
                        <th>Score</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredStudents.map((stud: any) => (
                        <tr key={stud.user_id}>
                          <td>{stud.degree}</td>
                          <td>{stud.domain}</td>
                          <td>{stud.passout_year}</td>
                          <td style={{ textTransform: 'capitalize' }}>{stud.experience_level}</td>
                          <td>{stud.contact_number}</td>
                          <td style={{ color: stud.hasTeam ? 'var(--success)' : 'var(--text-muted)' }}>{stud.hasTeam ? 'In a team' : 'No team yet'}</td>
                          <td style={{ fontWeight: 600 }}>{stud.score}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--border-color)', paddingTop: '20px' }}>
                <button onClick={() => setShowDetailsModal(false)} className="btn btn-secondary" style={{ padding: '10px 24px' }}>Close</button>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
