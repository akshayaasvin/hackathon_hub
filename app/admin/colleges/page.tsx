'use client'

import React, { useState, useEffect } from 'react'
import { createClient } from '../../../lib/supabase/client'
import { Plus, Search, Eye, Edit3, Trash2, Check, X, Trophy, Users, BookOpen, Activity, TrendingUp } from 'lucide-react'

export default function AdminCollegesPage() {
  const [colleges, setColleges] = useState<any[]>([])
  const [students, setStudents] = useState<any[]>([])
  const [teamMembers, setTeamMembers] = useState<any[]>([])
  const [teams, setTeams] = useState<any[]>([])
  const [evaluations, setEvaluations] = useState<any[]>([])
  const [registrations, setRegistrations] = useState<any[]>([])
  
  const [searchQuery, setSearchQuery] = useState('')
  const [studentSearchQuery, setStudentSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [showFormModal, setShowFormModal] = useState(false)
  const [editingCollege, setEditingCollege] = useState<any>(null)
  const [selectedCollege, setSelectedCollege] = useState<any>(null)
  const [showDetailsModal, setShowDetailsModal] = useState(false)

  const [formData, setFormData] = useState({
    college_name: '',
    email: '',
    password: '',
    status: 'active'
  })

  const supabase = createClient()

  useEffect(() => {
    loadColleges()
  }, [])

  const loadColleges = async () => {
    try {
      setLoading(true)
      const [collegesRes, studentsRes, teamMembersRes, teamsRes, evaluationsRes, registrationsRes] = await Promise.all([
        supabase.from('colleges').select('*'),
        supabase.from('students').select('*'),
        supabase.from('team_members').select('*'),
        supabase.from('teams').select('*'),
        supabase.from('evaluations').select('*'),
        supabase.from('registrations').select('*')
      ])

      setColleges(collegesRes.data || [])
      setStudents(studentsRes.data || [])
      setTeamMembers(teamMembersRes.data || [])
      setTeams(teamsRes.data || [])
      setEvaluations(evaluationsRes.data || [])
      setRegistrations(registrationsRes.data || [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const handleOpenCreate = () => {
    setEditingCollege(null)
    setFormData({
      college_name: '',
      email: '',
      password: 'password',
      status: 'active'
    })
    setShowFormModal(true)
  }

  const handleOpenEdit = (college: any) => {
    setEditingCollege(college)
    setFormData({
      college_name: college.college_name,
      email: college.email,
      password: college.password || 'password',
      status: college.status || 'active'
    })
    setShowFormModal(true)
  }

  const handleOpenDetails = (college: any) => {
    setSelectedCollege(college)
    setStudentSearchQuery('')
    setShowDetailsModal(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setActionLoading(true)

    if (editingCollege) {
      // Update
      const { error } = await supabase
        .from('colleges')
        .update({
          college_name: formData.college_name,
          email: formData.email,
          password: formData.password,
          status: formData.status
        })
        .eq('id', editingCollege.id)

      if (error) {
        alert('Error: ' + error.message)
      } else {
        alert('College updated successfully!')
        setShowFormModal(false)
        loadColleges()
      }
    } else {
      // Create
      const { error } = await supabase
        .from('colleges')
        .insert(formData)

      if (error) {
        alert('Error: ' + error.message)
      } else {
        alert('College created successfully!')
        setShowFormModal(false)
        loadColleges()
      }
    }
    setActionLoading(false)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this college? This will also remove associated college login accounts.')) return
    setActionLoading(true)
    const { error } = await supabase.from('colleges').delete().eq('id', id)
    if (error) {
      alert('Error: ' + error.message)
    } else {
      alert('College deleted successfully!')
      loadColleges()
    }
    setActionLoading(false)
  }

  const toggleStatus = async (college: any) => {
    const newStatus = college.status === 'active' ? 'inactive' : 'active'
    setActionLoading(true)
    const { error } = await supabase
      .from('colleges')
      .update({ status: newStatus })
      .eq('id', college.id)
    if (error) {
      alert('Error: ' + error.message)
    } else {
      alert(`College status updated to ${newStatus}!`)
      loadColleges()
    }
    setActionLoading(false)
  }

  const getStudentDetails = (student: any) => {
    const regNo = student.register_number || `REG2026${(student.department || 'CS').substring(0, 2).toUpperCase()}${String(student.id || '').replace(/[^a-zA-Z0-9]/g, '').substring(0, 4).toUpperCase()}`
    const member = teamMembers.find((tm: any) => tm.user_id === student.id)
    const teamObj = member ? teams.find((t: any) => t.id === member.team_id) : null
    const teamName = teamObj ? teamObj.team_name : '-'
    const scoreObj = member ? evaluations.find((e: any) => e.team_id === member.team_id) : null
    const score = scoreObj ? (scoreObj.total_score || 0) : 0
    return {
      ...student,
      register_number: regNo,
      teamName,
      score
    }
  }

  const getCollegesLeaderboard = () => {
    const leaderboard = colleges.map(col => {
      const colStudents = students.filter((s: any) => s.college_id === col.id)
      const participantCount = colStudents.length
      const totalScore = colStudents.reduce((sum: number, stud: any) => {
        const member = teamMembers.find((tm: any) => tm.user_id === stud.id)
        if (member) {
          const teamEval = evaluations.find((e: any) => e.team_id === member.team_id)
          return sum + (teamEval ? (teamEval.total_score || 0) : 0)
        }
        return sum
      }, 0)
      return {
        ...col,
        participantCount,
        totalScore
      }
    })

    return [...leaderboard].sort((a, b) => {
      if (b.participantCount !== a.participantCount) {
        return b.participantCount - a.participantCount
      }
      return b.totalScore - a.totalScore
    }).slice(0, 3)
  }

  const sortedColleges = [...colleges].sort((a, b) => 
    a.college_name.localeCompare(b.college_name)
  )

  const filteredColleges = sortedColleges.filter(col => 
    col.college_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    col.email.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const top3Colleges = getCollegesLeaderboard()

  if (loading) {
    return <div style={{ padding: '100px 20px', textAlign: 'center', fontSize: '18px', color: 'var(--text-secondary)' }}>Loading Colleges...</div>
  }

  return (
    <div className="premium-container fade-in" style={{ padding: '40px' }}>
      <style dangerouslySetInnerHTML={{ __html: `
        /* Custom responsive classes for AdminCollegesPage */
        .desktop-table-container {
          display: block;
        }
        .mobile-card-list {
          display: none;
        }
        .clickable-row {
          cursor: pointer;
          transition: var(--transition-smooth);
        }
        .clickable-row:hover td {
          background: rgba(79, 70, 229, 0.04) !important;
        }
        @media (max-width: 768px) {
          .desktop-table-container {
            display: none !important;
          }
          .mobile-card-list {
            display: flex !important;
            flex-direction: column;
            gap: 16px;
          }
          .mobile-table-card {
            background: var(--bg-card);
            border: 1px solid var(--border-color);
            border-radius: 16px;
            padding: 20px;
            box-shadow: var(--glass-shadow);
            transition: var(--transition-smooth);
          }
          .mobile-table-card:hover {
            border-color: var(--border-hover);
            transform: translateY(-2px);
          }
          .modal-overlay {
            align-items: flex-end;
          }
          .modal-content-large {
            width: 100% !important;
            max-width: 100% !important;
            border-radius: 24px 24px 0 0 !important;
            max-height: 92vh !important;
            margin-bottom: 0 !important;
            padding: 24px 16px !important;
          }
          .stat-grid-mobile {
            grid-template-columns: 1fr 1fr !important;
            gap: 12px !important;
          }
        }
      `}} />

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px', flexWrap: 'wrap', gap: '20px' }}>
        <div>
          <h1 style={{ fontSize: '32px', marginBottom: '8px', fontFamily: 'var(--font-display)' }}>🏫 College Management</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Register institutions, manage login authorization credentials and toggle account status.</p>
        </div>
        <button onClick={handleOpenCreate} className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
          <Plus size={18} /> Create College
        </button>
      </div>

      {/* Leaderboard section */}
      <h2 style={{ fontSize: '22px', marginBottom: '20px', fontFamily: 'var(--font-display)', display: 'flex', alignItems: 'center', gap: '8px' }}>
        🏆 Top Performing Colleges
      </h2>
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', 
        gap: '24px', 
        marginBottom: '40px' 
      }}>
        {top3Colleges.map((col: any, idx: number) => {
          const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉'
          const medalBg = idx === 0 
            ? 'linear-gradient(135deg, rgba(251, 191, 36, 0.08) 0%, rgba(217, 119, 6, 0.08) 100%)' 
            : idx === 1 
            ? 'linear-gradient(135deg, rgba(148, 163, 184, 0.08) 0%, rgba(71, 85, 105, 0.08) 100%)' 
            : 'linear-gradient(135deg, rgba(180, 83, 9, 0.08) 0%, rgba(120, 53, 15, 0.08) 100%)'
          
          const medalBorder = idx === 0 
            ? 'rgba(251, 191, 36, 0.25)' 
            : idx === 1 
            ? 'rgba(148, 163, 184, 0.25)' 
            : 'rgba(180, 83, 9, 0.25)'

          return (
            <div key={col.id} className="glass-card fade-in" style={{ 
              background: medalBg, 
              borderColor: medalBorder,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              padding: '24px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                <span style={{ fontSize: '32px' }}>{medal}</span>
                <div>
                  <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)' }}>{col.college_name}</h3>
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

      {/* Search Bar */}
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

      {/* Colleges Table (Desktop View) */}
      <div className="table-container fade-in desktop-table-container">
        <table className="premium-table">
          <thead>
            <tr>
              <th>College Name</th>
              <th>Email</th>
              <th>Status</th>
              <th>Created At</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredColleges.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>No colleges found.</td>
              </tr>
            ) : (
              filteredColleges.map((col) => {
                const isActive = col.status === 'active'
                return (
                  <tr key={col.id} className="clickable-row" onClick={() => handleOpenDetails(col)}>
                    <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{col.college_name}</td>
                    <td>{col.email}</td>
                    <td>
                      <span style={{
                        padding: '4px 10px',
                        borderRadius: '20px',
                        fontSize: '12px',
                        fontWeight: 600,
                        background: isActive ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                        color: isActive ? 'var(--success)' : 'var(--danger)'
                      }}>
                        {isActive ? 'ACTIVE' : 'INACTIVE'}
                      </span>
                    </td>
                    <td>{new Date(col.created_at).toLocaleDateString()}</td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button onClick={() => handleOpenDetails(col)} className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '13px', display: 'inline-flex', alignItems: 'center', gap: '4px' }} title="View Students">
                          <Eye size={14} /> <span>View Students</span>
                        </button>
                        <button onClick={() => handleOpenEdit(col)} className="btn btn-secondary" style={{ padding: '6px 10px', fontSize: '13px' }} title="Edit">
                          <Edit3 size={14} />
                        </button>
                        <button onClick={() => toggleStatus(col)} className="btn btn-secondary" style={{ padding: '6px 10px', fontSize: '13px', color: isActive ? 'var(--danger)' : 'var(--success)', borderColor: isActive ? 'rgba(239,68,68,0.2)' : 'rgba(16,185,129,0.2)' }} title={isActive ? 'Deactivate' : 'Activate'}>
                          {isActive ? <X size={14} /> : <Check size={14} />}
                        </button>
                        <button onClick={() => handleDelete(col.id)} className="btn btn-secondary" style={{ padding: '6px 10px', fontSize: '13px', color: 'var(--danger)', borderColor: 'rgba(239,68,68,0.2)' }} title="Delete">
                          <Trash2 size={14} />
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

      {/* Colleges Mobile Card List View */}
      <div className="mobile-card-list">
        {filteredColleges.length === 0 ? (
          <div className="glass-card" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
            No colleges found.
          </div>
        ) : (
          filteredColleges.map((col) => {
            const isActive = col.status === 'active'
            return (
              <div key={col.id} className="mobile-table-card fade-in" onClick={() => handleOpenDetails(col)}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                  <div>
                    <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>{col.college_name}</h3>
                    <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{col.email}</span>
                  </div>
                  <span style={{
                    padding: '4px 10px',
                    borderRadius: '20px',
                    fontSize: '11px',
                    fontWeight: 600,
                    background: isActive ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                    color: isActive ? 'var(--success)' : 'var(--danger)'
                  }}>
                    {isActive ? 'ACTIVE' : 'INACTIVE'}
                  </span>
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px' }}>
                  Registered: {new Date(col.created_at).toLocaleDateString()}
                </div>
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', flexWrap: 'wrap' }} onClick={(e) => e.stopPropagation()}>
                  <button onClick={() => handleOpenDetails(col)} className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '13px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <Eye size={14} /> <span>View Students</span>
                  </button>
                  <button onClick={() => handleOpenEdit(col)} className="btn btn-secondary" style={{ padding: '6px 10px', fontSize: '13px' }}>
                    <Edit3 size={14} />
                  </button>
                  <button onClick={() => toggleStatus(col)} className="btn btn-secondary" style={{ padding: '6px 10px', fontSize: '13px', color: isActive ? 'var(--danger)' : 'var(--success)' }}>
                    {isActive ? <X size={14} /> : <Check size={14} />}
                  </button>
                  <button onClick={() => handleDelete(col.id)} className="btn btn-secondary" style={{ padding: '6px 10px', fontSize: '13px', color: 'var(--danger)' }}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Create / Edit Form Modal */}
      {showFormModal && (
        <div className="modal-overlay">
          <div className="glass-card fade-in" style={{ width: '100%', maxWidth: '480px', padding: '32px' }}>
            <h2 style={{ fontSize: '22px', marginBottom: '8px', fontFamily: 'var(--font-display)' }}>
              {editingCollege ? 'Edit College' : 'Create New College'}
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '24px' }}>
              Define login credentials and properties for the institution.
            </p>

            <form onSubmit={handleSubmit}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', marginBottom: '28px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600, fontSize: '13px', color: 'var(--text-secondary)' }}>College Name *</label>
                  <input 
                    name="college_name" 
                    value={formData.college_name} 
                    onChange={(e) => setFormData({ ...formData, college_name: e.target.value })} 
                    required 
                    className="premium-input"
                    placeholder="e.g. PSNA College of Engineering"
                  />
                </div>
                
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600, fontSize: '13px', color: 'var(--text-secondary)' }}>Email Address *</label>
                  <input 
                    type="email"
                    name="email" 
                    value={formData.email} 
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })} 
                    required 
                    className="premium-input"
                    placeholder="e.g. psna@college.com"
                  />
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600, fontSize: '13px', color: 'var(--text-secondary)' }}>Password *</label>
                  <input 
                    type="password"
                    name="password" 
                    value={formData.password} 
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })} 
                    required 
                    className="premium-input"
                    placeholder="Password"
                  />
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600, fontSize: '13px', color: 'var(--text-secondary)' }}>Status</label>
                  <select 
                    value={formData.status} 
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })} 
                    className="premium-input premium-select"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setShowFormModal(false)} className="btn btn-secondary" style={{ padding: '8px 20px' }}>Cancel</button>
                <button type="submit" disabled={actionLoading} className="btn btn-primary" style={{ padding: '8px 24px' }}>
                  {actionLoading ? 'Saving...' : 'Save College'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* College Details and Students Modal */}
      {showDetailsModal && selectedCollege && (() => {
        const collegeStudents = students.filter((s: any) => s.college_id === selectedCollege.id)
        const formattedStudents = collegeStudents.map(getStudentDetails)
        const sortedStudents = [...formattedStudents].sort((a, b) => a.name.localeCompare(b.name))
        const filteredStudents = sortedStudents.filter((s: any) => 
          s.name.toLowerCase().includes(studentSearchQuery.toLowerCase()) ||
          s.register_number.toLowerCase().includes(studentSearchQuery.toLowerCase()) ||
          s.email.toLowerCase().includes(studentSearchQuery.toLowerCase())
        )

        const totalStuds = sortedStudents.length
        const activeParts = sortedStudents.filter((s: any) => 
          s.status === 'Nominated' || 
          registrations.some((r: any) => r.user_id === s.id) || 
          teamMembers.some((tm: any) => tm.user_id === s.id)
        ).length

        const scores = sortedStudents.map(s => s.score)
        const avgScore = scores.length > 0 ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1) : '0'
        const maxScore = scores.length > 0 ? Math.max(...scores) : 0

        return (
          <div className="modal-overlay" style={{ zIndex: 1100 }}>
            <div className="glass-card fade-in modal-content-large" style={{ 
              width: '95%', 
              maxWidth: '1000px', 
              padding: '32px', 
              maxHeight: '90vh', 
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '24px'
            }}>
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h2 style={{ fontSize: '24px', fontFamily: 'var(--font-display)', marginBottom: '4px' }}>
                    🏫 {selectedCollege.college_name}
                  </h2>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
                    Institution Portal • {selectedCollege.email} • <span style={{ 
                      color: selectedCollege.status === 'active' ? 'var(--success)' : 'var(--danger)',
                      fontWeight: 600
                    }}>{selectedCollege.status.toUpperCase()}</span>
                  </p>
                </div>
                <button 
                  onClick={() => setShowDetailsModal(false)} 
                  className="btn btn-secondary" 
                  style={{ padding: '8px 12px', border: '1px solid var(--border-color)' }}
                >
                  <X size={18} />
                </button>
              </div>

              {/* College Statistics */}
              <div className="stat-grid-mobile" style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
                gap: '20px' 
              }}>
                {/* Total Students */}
                <div className="glass-card stat-card-gradient" style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '16px 20px' }}>
                  <div style={{ background: 'rgba(79, 70, 229, 0.1)', padding: '10px', borderRadius: '10px', color: 'var(--primary)' }}>
                    <Users size={20} />
                  </div>
                  <div>
                    <h4 style={{ fontSize: '20px', color: 'var(--text-primary)' }}>{totalStuds}</h4>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>Total Students</p>
                  </div>
                </div>

                {/* Active Participants */}
                <div className="glass-card stat-card-gradient" style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '16px 20px' }}>
                  <div style={{ background: 'rgba(16, 185, 129, 0.1)', padding: '10px', borderRadius: '10px', color: 'var(--success)' }}>
                    <Activity size={20} />
                  </div>
                  <div>
                    <h4 style={{ fontSize: '20px', color: 'var(--text-primary)' }}>{activeParts}</h4>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>Active Participants</p>
                  </div>
                </div>

                {/* Average Score */}
                <div className="glass-card stat-card-gradient" style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '16px 20px' }}>
                  <div style={{ background: 'rgba(6, 182, 212, 0.1)', padding: '10px', borderRadius: '10px', color: 'var(--secondary)' }}>
                    <TrendingUp size={20} />
                  </div>
                  <div>
                    <h4 style={{ fontSize: '20px', color: 'var(--text-primary)' }}>{avgScore}</h4>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>Average Score</p>
                  </div>
                </div>

                {/* Highest Score */}
                <div className="glass-card stat-card-gradient" style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '16px 20px' }}>
                  <div style={{ background: 'rgba(245, 158, 11, 0.1)', padding: '10px', borderRadius: '10px', color: 'var(--warning)' }}>
                    <Trophy size={20} />
                  </div>
                  <div>
                    <h4 style={{ fontSize: '20px', color: 'var(--text-primary)' }}>{maxScore}</h4>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>Highest Score</p>
                  </div>
                </div>
              </div>

              {/* Student Search and Title */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', borderTop: '1px solid var(--border-color)', paddingTop: '20px' }}>
                <h3 style={{ fontSize: '18px', fontFamily: 'var(--font-display)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <BookOpen size={18} color="var(--primary)" /> Student Directory
                </h3>
                
                {totalStuds > 0 && (
                  <div style={{ position: 'relative', width: '100%', maxWidth: '320px' }}>
                    <input 
                      placeholder="Search students by name, register number or email..." 
                      value={studentSearchQuery} 
                      onChange={(e) => setStudentSearchQuery(e.target.value)}
                      className="premium-input"
                      style={{ paddingLeft: '40px', paddingTop: '8px', paddingBottom: '8px', fontSize: '14px' }}
                    />
                    <div style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}>
                      <Search size={16} />
                    </div>
                  </div>
                )}
              </div>

              {/* Students Directory Content */}
              {totalStuds === 0 ? (
                /* Empty state */
                <div style={{ 
                  textAlign: 'center', 
                  padding: '48px 24px', 
                  background: 'rgba(79, 70, 229, 0.02)', 
                  border: '2px dashed var(--border-color)', 
                  borderRadius: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '12px'
                }}>
                  <Users size={48} style={{ color: 'var(--text-muted)', opacity: 0.4 }} />
                  <p style={{ color: 'var(--text-secondary)', fontWeight: 500, fontSize: '16px' }}>
                    No students are registered for this college yet.
                  </p>
                </div>
              ) : filteredStudents.length === 0 ? (
                /* No search result */
                <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-secondary)' }}>
                  No students found matching your search.
                </div>
              ) : (
                <>
                  {/* Desktop Table View */}
                  <div className="table-container fade-in desktop-table-container">
                    <table className="premium-table" style={{ fontSize: '14px' }}>
                      <thead>
                        <tr>
                          <th>Student Name</th>
                          <th>Register Number</th>
                          <th>Email</th>
                          <th>Department</th>
                          <th>Year</th>
                          <th>Team</th>
                          <th>Score</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredStudents.map((stud: any) => {
                          const isNominated = stud.status === 'Nominated'
                          return (
                            <tr key={stud.id}>
                              <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{stud.name}</td>
                              <td><code style={{ fontSize: '13px', background: 'rgba(0,0,0,0.03)', padding: '2px 6px', borderRadius: '4px' }}>{stud.register_number}</code></td>
                              <td>{stud.email}</td>
                              <td>{stud.department || '-'}</td>
                              <td>Year {stud.year}</td>
                              <td style={{ color: stud.teamName !== '-' ? 'var(--primary)' : 'var(--text-muted)', fontWeight: stud.teamName !== '-' ? 600 : 400 }}>{stud.teamName}</td>
                              <td style={{ fontWeight: 600, color: stud.score > 0 ? 'var(--accent)' : 'var(--text-muted)' }}>{stud.score}</td>
                              <td>
                                <span style={{
                                  padding: '3px 8px',
                                  borderRadius: '20px',
                                  fontSize: '11px',
                                  fontWeight: 600,
                                  background: isNominated ? 'rgba(245, 158, 11, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                                  color: isNominated ? 'var(--warning)' : 'var(--success)'
                                }}>
                                  {stud.status.toUpperCase()}
                                </span>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile Cards View */}
                  <div className="mobile-card-list">
                    {filteredStudents.map((stud: any) => {
                      const isNominated = stud.status === 'Nominated'
                      return (
                        <div key={stud.id} className="mobile-table-card">
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                            <div>
                              <h4 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>{stud.name}</h4>
                              <code style={{ fontSize: '11px', background: 'rgba(0,0,0,0.03)', padding: '2px 6px', borderRadius: '4px' }}>{stud.register_number}</code>
                            </div>
                            <span style={{
                              padding: '3px 8px',
                              borderRadius: '20px',
                              fontSize: '10px',
                              fontWeight: 600,
                              background: isNominated ? 'rgba(245, 158, 11, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                              color: isNominated ? 'var(--warning)' : 'var(--success)'
                            }}>
                              {stud.status.toUpperCase()}
                            </span>
                          </div>
                          
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                            <div><strong>Email:</strong> {stud.email}</div>
                            <div><strong>Dept / Year:</strong> {stud.department} • Year {stud.year}</div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(0,0,0,0.04)', paddingTop: '8px', marginTop: '4px' }}>
                              <span><strong>Team:</strong> {stud.teamName}</span>
                              <span><strong>Score:</strong> <span style={{ color: stud.score > 0 ? 'var(--accent)' : 'var(--text-muted)', fontWeight: 600 }}>{stud.score}</span></span>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </>
              )}

              {/* Close Button Footer */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--border-color)', paddingTop: '20px', marginTop: '10px' }}>
                <button onClick={() => setShowDetailsModal(false)} className="btn btn-secondary" style={{ padding: '10px 24px' }}>
                  Close Directory
                </button>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
