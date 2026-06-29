'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../lib/supabase/client'
import { Users, BookOpen, AlertCircle, PlusCircle, CheckCircle, UserPlus, Eye, Trash2, ShieldAlert } from 'lucide-react'
import { withTimeout } from '../../lib/utils'

export default function CollegeDashboard() {
  const [user, setUser] = useState<any>(null)
  const [college, setCollege] = useState<any>(null)
  const [students, setStudents] = useState<any[]>([])
  const [hackathons, setHackathons] = useState<any[]>([])
  const [selectedStudent, setSelectedStudent] = useState<any>(null)
  const [showStudentModal, setShowStudentModal] = useState(false)
  const [showRegisterModal, setShowRegisterModal] = useState(false)
  const [showAddStudentModal, setShowAddStudentModal] = useState(false)
  const [selectedHackathon, setSelectedHackathon] = useState<any>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [stats, setStats] = useState({
    totalStudents: 0,
    registeredHackathons: 0,
    pendingApprovals: 0,
    winners: 0
  })
  
  // Registration history of the selected student
  const [studentRegHistory, setStudentRegHistory] = useState<any[]>([])

  // Student register form state
  const [newStudentForm, setNewStudentForm] = useState({
    name: '',
    email: '',
    department: '',
    year: '1'
  })

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
      
      const { data: { user } } = await withTimeout(supabase.auth.getUser(), 5000)
      if (!user) {
        router.push('/login')
        return
      }
      setUser(user)

      // Fetch college info and hackathons
      const [collegeRes, hackathonsRes] = await withTimeout(
        Promise.all([
          supabase.from('colleges').select('*').eq('id', user.id).maybeSingle(),
          supabase.from('hackathons').select('*').eq('status', 'published')
        ]),
        5000
      )

      let col = collegeRes.data
      setHackathons(hackathonsRes.data || [])

      if (!col) {
        // Fallback: If no college record exists in the colleges table but the role is college,
        // create a default one for this user
        const { data: newCol } = await withTimeout(
          supabase
            .from('colleges')
            .insert({
              id: user.id,
              college_name: user.user_metadata?.college_name || 'College Name',
              email: user.email,
              status: 'active'
            })
            .select()
            .single(),
          5000
        )
        col = newCol
      }
      setCollege(col)

      if (col) {
        // Get students belonging to this college
        const { data: studentsData } = await withTimeout(
          supabase
            .from('students')
            .select('*')
            .eq('college_id', col.id),
          5000
        )
        const studentsList = studentsData || []
        setStudents(studentsList)

        // Get registrations of all these students to compute stats
        const studentIds = studentsList.map((s: any) => s.id)
        let registrationsList: any[] = []
        let pending = 0
        let winnersCount = 0

        if (studentIds.length > 0) {
          const [regsRes, teamMembersRes, winnersRes] = await withTimeout(
            Promise.all([
              supabase.from('registrations').select('*').in('user_id', studentIds),
              supabase.from('team_members').select('*').in('user_id', studentIds),
              supabase.from('winners').select('*')
            ]),
            5000
          )
          registrationsList = regsRes.data || []
          pending = registrationsList.filter((r: any) => r.registration_status === 'pending').length

          // Find winners
          const teamIds = (teamMembersRes.data || []).map((tm: any) => tm.team_id)
          if (teamIds.length > 0) {
            const collegeWinners = (winnersRes.data || []).filter((w: any) => teamIds.includes(w.team_id))
            winnersCount = collegeWinners.length
          }
        }

        setStats({
          totalStudents: studentsList.length,
          registeredHackathons: registrationsList.length,
          pendingApprovals: pending,
          winners: winnersCount
        })
      }

    } catch (err: any) {
      console.error('Error:', err)
      setError(err.message || 'Failed to load college dashboard. Connection timed out.')
    } finally {
      setLoading(false)
    }
  }

  const handleOpenRegisterStudentModal = () => {
    setNewStudentForm({
      name: '',
      email: '',
      department: '',
      year: '1'
    })
    setShowAddStudentModal(true)
  }

  const handleCreateStudent = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!college) return
    setActionLoading(true)

    const { error } = await supabase.from('students').insert({
      college_id: college.id,
      name: newStudentForm.name,
      email: newStudentForm.email,
      department: newStudentForm.department,
      year: parseInt(newStudentForm.year),
      status: 'Active'
    })

    if (error) {
      alert('Error creating student: ' + error.message)
    } else {
      alert('Student created and registered successfully!')
      setShowAddStudentModal(false)
      loadData()
    }
    setActionLoading(false)
  }

  const handleViewStudentDetails = async (student: any) => {
    setSelectedStudent(student)
    setLoading(true)

    try {
      // Load registration history
      const { data: regs } = await supabase
        .from('registrations')
        .select('*, hackathons(name, theme)')
        .eq('user_id', student.id)
      
      setStudentRegHistory(regs || [])
      setShowStudentModal(true)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const handleOpenNominate = (student: any) => {
    setSelectedStudent(student)
    setSelectedHackathon(hackathons[0] || null)
    setShowRegisterModal(true)
  }

  const handleNominateConfirm = async () => {
    if (!selectedStudent || !selectedHackathon) return
    setActionLoading(true)

    // Check if student already registered for this hackathon
    const { data: existing } = await supabase
      .from('registrations')
      .select('*')
      .eq('user_id', selectedStudent.id)
      .eq('hackathon_id', selectedHackathon.id)
      .maybeSingle()

    if (existing) {
      alert('Student is already nominated/registered for this hackathon.')
      setActionLoading(false)
      return
    }

    // Insert pending registration
    const { error: regError } = await supabase.from('registrations').insert({
      hackathon_id: selectedHackathon.id,
      user_id: selectedStudent.id,
      registration_status: 'pending',
      payment_status: 'pending'
    })

    if (regError) {
      alert('Error: ' + regError.message)
    } else {
      // Update student status
      await supabase
        .from('students')
        .update({ status: 'Nominated' })
        .eq('id', selectedStudent.id)

      alert(`Student ${selectedStudent.name} nominated successfully!`)
      setShowRegisterModal(false)
      loadData()
    }
    setActionLoading(false)
  }

  const handleRemoveNomination = async (student: any) => {
    if (!confirm(`Are you sure you want to remove all nominations for ${student.name}?`)) return
    setActionLoading(true)

    // Delete registrations
    const { error: deleteError } = await supabase
      .from('registrations')
      .delete()
      .eq('user_id', student.id)

    if (deleteError) {
      alert('Error: ' + deleteError.message)
    } else {
      // Reset student status
      await supabase
        .from('students')
        .update({ status: 'Active' })
        .eq('id', student.id)

      alert(`Nominations removed successfully for ${student.name}!`)
      loadData()
    }
    setActionLoading(false)
  }

  const handleDeleteStudent = async (student: any) => {
    if (!confirm(`Are you sure you want to delete student ${student.name}? This will remove them from the college directory and delete user auth access.`)) return
    setActionLoading(true)

    // Delete registrations first
    await supabase.from('registrations').delete().eq('user_id', student.id)
    
    // Delete student
    const { error } = await supabase.from('students').delete().eq('id', student.id)

    if (error) {
      alert('Error: ' + error.message)
    } else {
      alert('Student deleted successfully!')
      loadData()
    }
    setActionLoading(false)
  }

  if (loading) {
    return <div style={{ padding: '100px 20px', textAlign: 'center', fontSize: '18px', color: 'var(--text-secondary)' }}>Loading College Dashboard...</div>
  }

  return (
    <div className="premium-container fade-in" style={{ padding: '40px' }}>
      {/* Header */}
      <div style={{ marginBottom: '36px' }}>
        <h1 style={{ fontSize: '32px', marginBottom: '8px', fontFamily: 'var(--font-display)' }}>🏫 College Portal</h1>
        <p style={{ color: 'var(--text-secondary)' }}>
          Institution: <span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{college?.college_name}</span>. Register student cohorts and manage event nominations.
        </p>
      </div>

      {/* Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '24px', marginBottom: '40px' }}>
        <div className="glass-card stat-card-gradient" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ background: 'rgba(79, 70, 229, 0.1)', padding: '12px', borderRadius: '12px', color: 'var(--primary)' }}>
            <Users size={24} />
          </div>
          <div>
            <h3 style={{ fontSize: '28px', color: 'var(--text-primary)' }}>{stats.totalStudents}</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Total Students</p>
          </div>
        </div>
        <div className="glass-card stat-card-gradient" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ background: 'rgba(16, 185, 129, 0.1)', padding: '12px', borderRadius: '12px', color: 'var(--success)' }}>
            <CheckCircle size={24} />
          </div>
          <div>
            <h3 style={{ fontSize: '28px', color: 'var(--text-primary)' }}>{stats.registeredHackathons}</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Registrations</p>
          </div>
        </div>
        <div className="glass-card stat-card-gradient" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ background: 'rgba(245, 158, 11, 0.1)', padding: '12px', borderRadius: '12px', color: 'var(--warning)' }}>
            <AlertCircle size={24} />
          </div>
          <div>
            <h3 style={{ fontSize: '28px', color: 'var(--text-primary)' }}>{stats.pendingApprovals}</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Pending Approvals</p>
          </div>
        </div>
        <div className="glass-card stat-card-gradient" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ background: 'rgba(6, 182, 212, 0.1)', padding: '12px', borderRadius: '12px', color: 'var(--secondary)' }}>
            <BookOpen size={24} />
          </div>
          <div>
            <h3 style={{ fontSize: '28px', color: 'var(--text-primary)' }}>{stats.winners}</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Winners</p>
          </div>
        </div>
      </div>

      {/* Control Buttons */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '40px' }}>
        <button onClick={handleOpenRegisterStudentModal} className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
          <UserPlus size={16} /> Register Student
        </button>
      </div>

      {/* Student Table */}
      <h2 style={{ fontSize: '20px', marginBottom: '20px', fontFamily: 'var(--font-display)', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <BookOpen size={20} color="var(--primary)" /> Student Directory
      </h2>

      <div className="table-container fade-in">
        <table className="premium-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Department</th>
              <th>Year</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {students.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                  No students in directory. Register students above to populate table.
                </td>
              </tr>
            ) : (
              students.map((student) => {
                const isNominated = student.status === 'Nominated'
                return (
                  <tr key={student.id}>
                    <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{student.name}</td>
                    <td>{student.email}</td>
                    <td>{student.department || '-'}</td>
                    <td>Year {student.year}</td>
                    <td>
                      <span style={{
                        padding: '4px 10px',
                        borderRadius: '20px',
                        fontSize: '12px',
                        fontWeight: 600,
                        background: isNominated ? 'rgba(245, 158, 11, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                        color: isNominated ? 'var(--warning)' : 'var(--success)'
                      }}>
                        {student.status.toUpperCase()}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button onClick={() => handleViewStudentDetails(student)} className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '13px' }}>
                          <Eye size={12} style={{ display: 'inline', marginRight: '4px' }} /> View
                        </button>
                        
                        {isNominated ? (
                          <button onClick={() => handleRemoveNomination(student)} className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '13px', color: 'var(--danger)', borderColor: 'rgba(239,68,68,0.2)' }}>
                            Cancel Nomination
                          </button>
                        ) : (
                          <button onClick={() => handleOpenNominate(student)} className="btn btn-primary" style={{ padding: '6px 12px', fontSize: '13px' }}>
                            Nominate
                          </button>
                        )}
                        
                        <button onClick={() => handleDeleteStudent(student)} className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '13px', color: 'var(--danger)', borderColor: 'rgba(239,68,68,0.2)' }} title="Delete Student">
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Add Student Modal */}
      {showAddStudentModal && (
        <div className="modal-overlay">
          <div className="glass-card fade-in" style={{ width: '100%', maxWidth: '440px', padding: '32px' }}>
            <h2 style={{ fontSize: '20px', marginBottom: '8px', fontFamily: 'var(--font-display)' }}>Register Student</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '24px' }}>Add a student to the college directory.</p>

            <form onSubmit={handleCreateStudent}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600, fontSize: '13px', color: 'var(--text-secondary)' }}>Student Full Name *</label>
                  <input 
                    value={newStudentForm.name} 
                    onChange={(e) => setNewStudentForm({ ...newStudentForm, name: e.target.value })} 
                    required 
                    className="premium-input"
                    placeholder="e.g. John Doe"
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600, fontSize: '13px', color: 'var(--text-secondary)' }}>Email Address *</label>
                  <input 
                    type="email"
                    value={newStudentForm.email} 
                    onChange={(e) => setNewStudentForm({ ...newStudentForm, email: e.target.value })} 
                    required 
                    className="premium-input"
                    placeholder="e.g. student@college.edu"
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600, fontSize: '13px', color: 'var(--text-secondary)' }}>Branch/Department *</label>
                  <input 
                    value={newStudentForm.department} 
                    onChange={(e) => setNewStudentForm({ ...newStudentForm, department: e.target.value })} 
                    required 
                    className="premium-input"
                    placeholder="e.g. Computer Science"
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600, fontSize: '13px', color: 'var(--text-secondary)' }}>Year of Study</label>
                  <select 
                    value={newStudentForm.year} 
                    onChange={(e) => setNewStudentForm({ ...newStudentForm, year: e.target.value })} 
                    className="premium-input premium-select"
                  >
                    <option value="1">Year 1</option>
                    <option value="2">Year 2</option>
                    <option value="3">Year 3</option>
                    <option value="4">Year 4</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setShowAddStudentModal(false)} className="btn btn-secondary" style={{ padding: '8px 16px' }}>Cancel</button>
                <button type="submit" disabled={actionLoading} className="btn btn-primary" style={{ padding: '8px 24px' }}>
                  {actionLoading ? 'Creating...' : 'Register'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Nominate Student Modal */}
      {showRegisterModal && selectedStudent && (
        <div className="modal-overlay">
          <div className="glass-card fade-in" style={{ width: '100%', maxWidth: '440px', padding: '32px' }}>
            <h2 style={{ fontSize: '20px', marginBottom: '8px', fontFamily: 'var(--font-display)' }}>Nominate Student</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '24px' }}>
              Nominate student <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{selectedStudent.name}</span> for a published hackathon round.
            </p>
            
            <div style={{ marginBottom: '28px' }}>
              <label style={{ display: 'block', fontWeight: 600, fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px' }}>Target Hackathon</label>
              <select
                value={selectedHackathon?.id || ''}
                onChange={(e) => setSelectedHackathon(hackathons.find(h => h.id === e.target.value))}
                className="premium-input premium-select"
              >
                {hackathons.map(h => (
                  <option key={h.id} value={h.id}>{h.name}</option>
                ))}
              </select>
            </div>
            
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowRegisterModal(false)} className="btn btn-secondary" style={{ padding: '8px 16px' }}>Cancel</button>
              <button 
                onClick={handleNominateConfirm} 
                disabled={!selectedHackathon || actionLoading} 
                className="btn btn-primary"
                style={{ padding: '8px 24px' }}
              >
                {actionLoading ? 'Nominating...' : 'Confirm Nomination'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Student Details and Registration History Modal */}
      {showStudentModal && selectedStudent && (
        <div className="modal-overlay">
          <div className="glass-card fade-in" style={{ width: '100%', maxWidth: '520px', padding: '32px' }}>
            <h2 style={{ fontSize: '22px', marginBottom: '16px', fontFamily: 'var(--font-display)' }}>Student Roster Details</h2>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '28px' }}>
              <p><strong>Name:</strong> <span style={{ color: 'var(--text-primary)' }}>{selectedStudent.name}</span></p>
              <p><strong>Email:</strong> <span style={{ color: 'var(--text-primary)' }}>{selectedStudent.email}</span></p>
              <p><strong>Department:</strong> <span style={{ color: 'var(--text-primary)' }}>{selectedStudent.department}</span></p>
              <p><strong>Year of Study:</strong> <span style={{ color: 'var(--text-primary)' }}>Year {selectedStudent.year}</span></p>
              <p><strong>Roster Status:</strong> <span style={{ color: 'var(--primary)', fontWeight: 600 }}>{selectedStudent.status.toUpperCase()}</span></p>
            </div>

            <h3 style={{ fontSize: '16px', color: 'var(--text-primary)', marginBottom: '12px', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px' }}>
              Registration History
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '180px', overflowY: 'auto', marginBottom: '28px' }}>
              {studentRegHistory.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>No registrations tracked for this student.</p>
              ) : (
                studentRegHistory.map((reg) => {
                  const s = reg.registration_status.toLowerCase()
                  const statusColor = s === 'confirmed' ? 'var(--success)' : s === 'pending' ? 'var(--warning)' : 'var(--danger)'
                  return (
                    <div key={reg.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'rgba(0,0,0,0.01)', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
                      <div style={{ fontSize: '13px' }}>
                        <p style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{reg.hackathons?.name}</p>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>Applied: {new Date(reg.registered_at).toLocaleDateString()}</p>
                      </div>
                      <span style={{ fontSize: '12px', fontWeight: 600, color: statusColor }}>
                        {reg.registration_status.toUpperCase()}
                      </span>
                    </div>
                  )
                })
              )}
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowStudentModal(false)} className="btn btn-secondary" style={{ padding: '10px 24px' }}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}