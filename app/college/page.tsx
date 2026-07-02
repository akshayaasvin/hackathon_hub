'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Users, BookOpen, Trophy, Send, Eye, X } from 'lucide-react'
import { withTimeout } from '@/lib/utils'

type Stage = 'Not registered' | 'Registered' | 'Team formed' | 'Submitted' | 'Evaluated' | 'Result declared'

export default function CollegeDashboard() {
  const [collegeProfile, setCollegeProfile] = useState<any>(null)
  const [students, setStudents] = useState<any[]>([])
  const [selectedStudent, setSelectedStudent] = useState<any>(null)
  const [showStudentModal, setShowStudentModal] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      setError(null)

      const {
        data: { user },
      } = await withTimeout(supabase.auth.getUser(), 5000)
      if (!user) {
        router.push('/login')
        return
      }

      const { data: profile } = await withTimeout(
        supabase.from('college_profiles').select('*').eq('user_id', user.id).maybeSingle(),
        5000
      )
      setCollegeProfile(profile)

      if (!profile) {
        setStudents([])
        return
      }

      const { data: participantProfiles } = await withTimeout(
        supabase.from('participant_profiles').select('*').eq('college_name', profile.college_name),
        5000
      )
      const participants = participantProfiles || []
      const userIds = participants.map((p) => p.user_id)

      if (userIds.length === 0) {
        setStudents([])
        return
      }

      const [usersRes, registrationsRes, teamMembersRes] = await withTimeout(
        Promise.all([
          supabase.from('users').select('*').in('id', userIds),
          supabase.from('registrations').select('*, hackathons(name)').in('user_id', userIds),
          supabase.from('team_members').select('*').in('user_id', userIds),
        ]),
        5000
      )

      const teamIds = [...new Set((teamMembersRes.data || []).map((tm: any) => tm.team_id))]

      const [teamsRes, submissionsRes, evaluationsRes, winnersRes] = teamIds.length
        ? await withTimeout(
            Promise.all([
              supabase.from('teams').select('*').in('id', teamIds),
              supabase.from('submissions').select('*').in('team_id', teamIds),
              supabase.from('evaluations').select('*').in('team_id', teamIds),
              supabase.from('winners').select('*').in('team_id', teamIds),
            ]),
            5000
          )
        : [
            { data: [] as any[] },
            { data: [] as any[] },
            { data: [] as any[] },
            { data: [] as any[] },
          ]

      const usersById = new Map((usersRes.data || []).map((u: any) => [u.id, u]))
      const teamsById = new Map((teamsRes.data || []).map((t: any) => [t.id, t]))

      const merged = participants.map((p) => {
        const teamMember = (teamMembersRes.data || []).find((tm: any) => tm.user_id === p.user_id)
        const teamId = teamMember?.team_id
        const team = teamId ? teamsById.get(teamId) : null
        const submission = teamId ? (submissionsRes.data || []).find((s: any) => s.team_id === teamId) : null
        const evaluation = teamId ? (evaluationsRes.data || []).find((e: any) => e.team_id === teamId) : null
        const winner = teamId ? (winnersRes.data || []).find((w: any) => w.team_id === teamId) : null
        const registrations = (registrationsRes.data || []).filter((r: any) => r.user_id === p.user_id)

        let stage: Stage = 'Not registered'
        if (registrations.length > 0) stage = 'Registered'
        if (teamId) stage = 'Team formed'
        if (submission?.status === 'submitted') stage = 'Submitted'
        if (evaluation) stage = 'Evaluated'
        if (winner) stage = 'Result declared'

        return {
          ...p,
          user: usersById.get(p.user_id),
          registrations,
          team,
          submission,
          evaluation,
          winner,
          stage,
        }
      })

      setStudents(merged)
    } catch (err: any) {
      console.error('Error:', err)
      setError(err.message || 'Failed to load college dashboard.')
    } finally {
      setLoading(false)
    }
  }

  const handleViewStudentDetails = (student: any) => {
    setSelectedStudent(student)
    setShowStudentModal(true)
  }

  if (loading) {
    return <div style={{ padding: '100px 20px', textAlign: 'center', fontSize: '18px', color: 'var(--text-secondary)' }}>Loading College Dashboard...</div>
  }

  if (error) {
    return (
      <div className="premium-container fade-in" style={{ maxWidth: '600px', marginTop: '60px' }}>
        <div className="glass-card" style={{ borderLeft: '4px solid var(--danger)', padding: '32px', textAlign: 'center' }}>
          <h2 style={{ color: 'var(--danger)', fontSize: '20px', marginBottom: '12px' }}>Loading Failure</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '24px' }}>{error}</p>
          <button onClick={loadData} className="btn btn-primary" style={{ padding: '10px 24px' }}>Retry</button>
        </div>
      </div>
    )
  }

  const teamsFormed = new Set(students.filter((s) => s.team).map((s) => s.team.id)).size
  const submissionsMade = students.filter((s) => s.submission?.status === 'submitted').length
  const topScore = students.reduce((max, s) => Math.max(max, s.evaluation?.total_score || 0), 0)

  const stageColor: Record<Stage, string> = {
    'Not registered': 'var(--text-muted)',
    Registered: 'var(--warning)',
    'Team formed': 'var(--accent)',
    Submitted: 'var(--primary)',
    Evaluated: 'var(--secondary)',
    'Result declared': 'var(--success)',
  }

  return (
    <div className="premium-container fade-in" style={{ padding: '40px' }}>
      <div style={{ marginBottom: '36px' }}>
        <h1 style={{ fontSize: '32px', marginBottom: '8px', fontFamily: 'var(--font-display)' }}>College Portal</h1>
        <p style={{ color: 'var(--text-secondary)' }}>
          Institution: <span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{collegeProfile?.college_name}</span>.
          Track your students' hackathon journey — this view is read-only.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '24px', marginBottom: '40px' }}>
        <div className="glass-card stat-card-gradient" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ background: 'rgba(79, 70, 229, 0.1)', padding: '12px', borderRadius: '12px', color: 'var(--primary)' }}>
            <Users size={24} />
          </div>
          <div>
            <h3 style={{ fontSize: '28px', color: 'var(--text-primary)' }}>{students.length}</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Total Students</p>
          </div>
        </div>
        <div className="glass-card stat-card-gradient" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ background: 'rgba(16, 185, 129, 0.1)', padding: '12px', borderRadius: '12px', color: 'var(--success)' }}>
            <BookOpen size={24} />
          </div>
          <div>
            <h3 style={{ fontSize: '28px', color: 'var(--text-primary)' }}>{teamsFormed}</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Teams Formed</p>
          </div>
        </div>
        <div className="glass-card stat-card-gradient" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ background: 'rgba(245, 158, 11, 0.1)', padding: '12px', borderRadius: '12px', color: 'var(--warning)' }}>
            <Send size={24} />
          </div>
          <div>
            <h3 style={{ fontSize: '28px', color: 'var(--text-primary)' }}>{submissionsMade}</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Submissions Made</p>
          </div>
        </div>
        <div className="glass-card stat-card-gradient" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ background: 'rgba(6, 182, 212, 0.1)', padding: '12px', borderRadius: '12px', color: 'var(--secondary)' }}>
            <Trophy size={24} />
          </div>
          <div>
            <h3 style={{ fontSize: '28px', color: 'var(--text-primary)' }}>{topScore.toFixed(1)}</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Top Score</p>
          </div>
        </div>
      </div>

      <h2 style={{ fontSize: '20px', marginBottom: '20px', fontFamily: 'var(--font-display)', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <BookOpen size={20} color="var(--primary)" /> Student Directory
      </h2>

      <div className="table-container fade-in">
        <table className="premium-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Degree / Domain</th>
              <th>Progress</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {students.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                  No students from your college have registered yet.
                </td>
              </tr>
            ) : (
              students.map((student) => (
                <tr key={student.user_id}>
                  <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{student.user?.full_name || '-'}</td>
                  <td>{student.user?.email || '-'}</td>
                  <td>{student.degree} · {student.domain}</td>
                  <td>
                    <span style={{ padding: '4px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 600, background: 'rgba(0,0,0,0.04)', color: stageColor[student.stage as Stage] }}>
                      {student.stage}
                    </span>
                  </td>
                  <td>
                    <button onClick={() => handleViewStudentDetails(student)} className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '13px' }}>
                      <Eye size={12} style={{ display: 'inline', marginRight: '4px' }} /> View
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showStudentModal && selectedStudent && (
        <div className="modal-overlay">
          <div className="glass-card fade-in" style={{ width: '100%', maxWidth: '520px', padding: '32px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '22px', fontFamily: 'var(--font-display)' }}>Student Details</h2>
              <button onClick={() => setShowStudentModal(false)} className="btn btn-secondary" style={{ padding: '6px 10px' }}>
                <X size={16} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '24px' }}>
              <p><strong>Name:</strong> <span style={{ color: 'var(--text-primary)' }}>{selectedStudent.user?.full_name}</span></p>
              <p><strong>Email:</strong> <span style={{ color: 'var(--text-primary)' }}>{selectedStudent.user?.email}</span></p>
              <p><strong>Degree:</strong> {selectedStudent.degree}</p>
              <p><strong>Domain:</strong> {selectedStudent.domain}</p>
              <p><strong>Passout Year:</strong> {selectedStudent.passout_year}</p>
              <p><strong>Experience:</strong> <span style={{ textTransform: 'capitalize' }}>{selectedStudent.experience_level}</span></p>
              <p><strong>Contact:</strong> {selectedStudent.contact_number}</p>
              <p><strong>Team:</strong> {selectedStudent.team?.team_name || 'Not in a team yet'}</p>
              <p><strong>Score:</strong> {selectedStudent.evaluation?.total_score ?? '-'}</p>
            </div>

            <h3 style={{ fontSize: '16px', color: 'var(--text-primary)', marginBottom: '12px', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px' }}>
              Registration History
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '180px', overflowY: 'auto', marginBottom: '20px' }}>
              {selectedStudent.registrations.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>No registrations yet.</p>
              ) : (
                selectedStudent.registrations.map((reg: any) => (
                  <div key={reg.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
                    <div style={{ fontSize: '13px' }}>
                      <p style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{reg.hackathons?.name}</p>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>Registered: {new Date(reg.registered_at).toLocaleDateString()}</p>
                    </div>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>{reg.registration_status.toUpperCase()}</span>
                  </div>
                ))
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowStudentModal(false)} className="btn btn-secondary" style={{ padding: '10px 24px' }}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
