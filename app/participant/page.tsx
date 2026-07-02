'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Calendar, Users, Send, PlusCircle, CheckCircle, Clock } from 'lucide-react'
import { withTimeout } from '@/lib/utils'

export default function ParticipantDashboard() {
  const [user, setUser] = useState<any>(null)
  const [hackathons, setHackathons] = useState<any[]>([])
  const [registeredIds, setRegisteredIds] = useState<Set<string>>(new Set())
  const [registrationStatus, setRegistrationStatus] = useState<Map<string, any>>(new Map())
  const [myTeams, setMyTeams] = useState<any[]>([])
  
  // Modals state
  const [showTeamModal, setShowTeamModal] = useState(false)
  const [showManageModal, setShowManageModal] = useState(false)
  const [showSubmitModal, setShowSubmitModal] = useState(false)
  const [selectedHackathon, setSelectedHackathon] = useState<any>(null)
  const [selectedTeam, setSelectedTeam] = useState<any>(null)
  
  // Forms state
  const [teamName, setTeamName] = useState('')
  const [teamMembers, setTeamMembers] = useState<any[]>([])
  const [inviteEmail, setInviteEmail] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  
  // Winner Alert Modal
  const [showWinnerAlert, setShowWinnerAlert] = useState(false)
  const [winnerMessage, setWinnerMessage] = useState('')
  
  const [submissionForm, setSubmissionForm] = useState({
    project_title: '',
    problem_statement: '',
    solution: '',
    features: '',
    repo_link: '',
    demo_video_url: '',
    ppt_url: '',
    report_pdf_url: ''
  })
  
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

      // Fetch hackathons, registrations, and teams in parallel with 5s timeout
      const [hackathonsRes, registrationsRes, teamsRes] = await withTimeout(
        Promise.all([
          supabase.from('hackathons').select('*').eq('status', 'published'),
          supabase.from('registrations').select('hackathon_id, registration_status').eq('user_id', user.id),
          supabase.from('teams').select('*, hackathons(name)').eq('team_lead_id', user.id)
        ]),
        5000
      )

      if (hackathonsRes.error) throw hackathonsRes.error
      if (registrationsRes.error) throw registrationsRes.error
      if (teamsRes.error) throw teamsRes.error

      const hackathonData = hackathonsRes.data || []
      setHackathons(hackathonData)

      const registrations = registrationsRes.data || []
      const registered = new Set(registrations.map(r => r.hackathon_id))
      setRegisteredIds(registered)

      const statusMap = new Map()
      for (const reg of registrations) {
        statusMap.set(reg.hackathon_id, { registration: reg.registration_status })
      }
      setRegistrationStatus(statusMap)

      const teams = teamsRes.data || []
      setMyTeams(teams)

      // Batch check for winners using a single in query instead of checking in a loop
      if (teams && teams.length > 0) {
        const teamIds = teams.map(t => t.id)
        const { data: winnersData, error: winnersError } = await withTimeout(
          supabase
            .from('winners')
            .select('team_id, rank, prize_amount')
            .in('team_id', teamIds),
          5000
        )

        if (winnersError) throw winnersError

        if (winnersData && winnersData.length > 0) {
          for (const winner of winnersData) {
            const team = teams.find(t => t.id === winner.team_id)
            if (team && !localStorage.getItem(`winner_alert_${team.id}`)) {
              localStorage.setItem(`winner_alert_${team.id}`, 'shown')
              setWinnerMessage(`🎉 CONGRATULATIONS! 🎉\n\nYour team "${team.team_name}" ranked #${winner.rank} 🏆\nand won a cash prize of $${winner.prize_amount}!\n\nNavigate to the Certificates page to download your certificate.`)
              setShowWinnerAlert(true)
              break // Show one alert at a time to prevent overlapping overlays
            }
          }
        }
      }
      
    } catch (err: any) {
      console.error('Error loading participant dashboard:', err)
      setError(err.message || 'Failed to load participant dashboard. Request timed out.')
    } finally {
      setLoading(false)
    }
  }

  const handleRegister = async (hackathonId: string) => {
    setActionLoading(true)
    const { error } = await supabase.from('registrations').insert({
      hackathon_id: hackathonId,
      user_id: user?.id,
      registration_status: 'confirmed'
    })

    if (error) {
      alert('Registration failed: ' + error.message)
    } else {
      alert("You're registered! You can now form a team.")
      loadData()
    }
    setActionLoading(false)
  }

  const handleCreateTeam = async () => {
    if (!teamName.trim()) {
      alert('Please enter a team name')
      return
    }
    
    setActionLoading(true)
    
    const { data: team, error: teamError } = await supabase
      .from('teams')
      .insert({
        team_name: teamName,
        hackathon_id: selectedHackathon.id,
        team_lead_id: user?.id
      })
      .select()
      .single()
    
    if (teamError) {
      alert('Error: ' + teamError.message)
    } else {
      await supabase.from('team_members').insert({
        team_id: team.id,
        user_id: user?.id
      })
      
      alert('Team created successfully!')
      setShowTeamModal(false)
      setTeamName('')
      loadData()
    }
    setActionLoading(false)
  }

  const handleManageTeam = async (team: any) => {
    setSelectedTeam(team)
    const { data: members } = await supabase
      .from('team_members')
      .select('user_id')
      .eq('team_id', team.id)
    
    // Resolve email names
    if (members && members.length > 0) {
      const { data: usersData } = await supabase
        .from('users')
        .select('id, email, full_name')
        .in('id', members.map(m => m.user_id))
      setTeamMembers(usersData || [])
    } else {
      setTeamMembers([])
    }
    setShowManageModal(true)
  }

  const handleInviteMember = async () => {
    if (!inviteEmail.trim()) {
      alert('Please enter an email')
      return
    }
    
    const { data: invitedUser } = await supabase
      .from('users')
      .select('id, email')
      .eq('email', inviteEmail)
      .single()
    
    if (!invitedUser) {
      alert('User not found. Ensure they registered on the portal.')
      return
    }
    
    // Check if already in the team
    if (teamMembers.some(m => m.id === invitedUser.id)) {
      alert('User is already a member of this team.')
      return
    }
    
    await supabase.from('team_members').insert({
      team_id: selectedTeam.id,
      user_id: invitedUser.id
    })
    
    alert('Member added to team!')
    setInviteEmail('')
    
    // Refresh members list
    const { data: updatedMembers } = await supabase
      .from('team_members')
      .select('user_id')
      .eq('team_id', selectedTeam.id)
    if (updatedMembers) {
      const { data: usersData } = await supabase
        .from('users')
        .select('id, email, full_name')
        .in('id', updatedMembers.map(m => m.user_id))
      setTeamMembers(usersData || [])
    }
    loadData()
  }

  const handleRemoveMember = async (memberId: string) => {
    if (memberId === user?.id) {
      alert('You cannot remove yourself. Leave team actions or team deletions are configured differently.')
      return
    }
    
    const { error } = await supabase
      .from('team_members')
      .delete()
      .eq('user_id', memberId)
      .eq('team_id', selectedTeam.id)
    
    if (error) {
      alert('Error removing member: ' + error.message)
    } else {
      alert('Member removed successfully!')
      setTeamMembers(prev => prev.filter(m => m.id !== memberId))
      loadData()
    }
  }

  const handleSubmitProject = async () => {
    if (!submissionForm.project_title.trim()) {
      alert('Please enter a project title')
      return
    }
    
    setActionLoading(true)

    const { error } = await supabase.from('submissions').insert({
      team_id: selectedTeam.id,
      hackathon_id: selectedHackathon?.id,
      project_title: submissionForm.project_title,
      problem_statement: submissionForm.problem_statement,
      solution: submissionForm.solution,
      features: submissionForm.features,
      repo_link: submissionForm.repo_link,
      demo_video_url: submissionForm.demo_video_url,
      ppt_url: submissionForm.ppt_url,
      report_pdf_url: submissionForm.report_pdf_url,
      status: 'submitted',
      submitted_at: new Date().toISOString()
    })

    if (error) {
      alert('Error: ' + error.message)
    } else {
      alert('Project submitted successfully!')
      setShowSubmitModal(false)
      setSubmissionForm({
        project_title: '',
        problem_statement: '',
        solution: '',
        features: '',
        repo_link: '',
        demo_video_url: '',
        ppt_url: '',
        report_pdf_url: ''
      })
      loadData()
    }
    setActionLoading(false)
  }

  const getStatusDisplay = (hackathonId: string) => {
    const status = registrationStatus.get(hackathonId)
    if (!status) return null
    
    if (status.registration === 'confirmed') {
      return { text: 'Confirmed', color: 'var(--success)', bg: 'var(--success-bg)', border: '1px solid var(--success-border)', icon: <CheckCircle size={14} /> }
    } else if (status.registration === 'pending') {
      return { text: 'Pending', color: 'var(--warning)', bg: 'var(--warning-bg)', border: '1px solid var(--warning-border)', icon: <Clock size={14} /> }
    } else {
      return { text: 'Cancelled', color: 'var(--danger)', bg: 'var(--danger-bg)', border: '1px solid var(--danger-border)', icon: null }
    }
  }

  if (loading) {
    return <div style={{ padding: '100px 20px', textAlign: 'center', fontSize: '18px', color: 'var(--text-secondary)' }}>Loading Participant Dashboard...</div>
  }

  if (error) {
    return (
      <div className="premium-container fade-in" style={{ maxWidth: '600px', marginTop: '60px' }}>
        <div className="glass-card" style={{ borderLeft: '4px solid var(--danger)', padding: '32px', textAlign: 'center' }}>
          <h2 style={{ color: 'var(--danger)', fontSize: '20px', marginBottom: '12px' }}>⚠️ Loading Failure</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '24px' }}>{error}</p>
          <button onClick={loadData} className="btn btn-primary" style={{ padding: '10px 24px' }}>
            Retry Loading
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="premium-container fade-in">
      {/* Winner Alert Modal */}
      {showWinnerAlert && (
        <div className="modal-overlay">
          <div className="glass-card" style={{ 
            background: 'linear-gradient(135deg, #e0f2fe 0%, #dcfce7 100%)', 
            border: '2px solid var(--secondary)',
            padding: '48px 32px', 
            borderRadius: '24px', 
            textAlign: 'center', 
            maxWidth: '520px',
            boxShadow: 'var(--glass-shadow)'
          }}>
            <div style={{ fontSize: '72px', marginBottom: '24px', animation: 'fadeIn 1s ease-out' }}>🏆</div>
            <h2 style={{ 
              color: 'var(--secondary)',
              fontSize: '32px',
              fontFamily: 'var(--font-display)',
              marginBottom: '20px'
            }}>
              VICTORY DECLARED!
            </h2>
            <p style={{ color: 'var(--text-primary)', fontSize: '16px', lineHeight: '1.6', whiteSpace: 'pre-line', marginBottom: '32px' }}>
              {winnerMessage}
            </p>
            <button 
              onClick={() => setShowWinnerAlert(false)}
              className="btn btn-success"
              style={{ padding: '12px 32px' }}
            >
              Claim Achievement
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ marginBottom: '40px' }}>
        <h1 style={{ fontSize: '32px', marginBottom: '8px', fontFamily: 'var(--font-display)' }}>Participant Dashboard</h1>
        <p style={{ color: 'var(--text-secondary)' }}>Welcome back, <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{user?.email}</span>. Configure teams, track applications and submit hackathon modules.</p>
      </div>

      {/* My Teams Grid */}
      {myTeams.length > 0 && (
        <div style={{ marginBottom: '48px' }}>
          <h2 style={{ fontSize: '20px', marginBottom: '20px', fontFamily: 'var(--font-display)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Users size={20} color="var(--primary)" /> Managed Teams
          </h2>
          <div className="responsive-card-grid">
            {myTeams.map((team) => (
              <div key={team.id} className="glass-card" style={{ borderLeft: '4px solid var(--primary)', padding: '24px' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>TEAM MANAGER</span>
                <h3 style={{ fontSize: '20px', margin: '6px 0 12px 0', color: 'var(--text-primary)' }}>{team.team_name}</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '24px' }}>
                  <strong>Hackathon:</strong> {team.hackathons?.name}
                </p>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button onClick={() => handleManageTeam(team)} className="btn btn-secondary" style={{ padding: '8px 16px', fontSize: '13px' }}>
                    Members & Invites
                  </button>
                  <button onClick={() => {
                    setSelectedTeam(team)
                    setSelectedHackathon(team.hackathons)
                    setShowSubmitModal(true)
                  }} className="btn btn-primary" style={{ padding: '8px 16px', fontSize: '13px' }}>
                    Submit Project
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Available Hackathons */}
      <h2 style={{ fontSize: '20px', marginBottom: '20px', fontFamily: 'var(--font-display)', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Calendar size={20} color="var(--secondary)" /> Open Hackathons
      </h2>
      
      {hackathons.length === 0 ? (
        <div className="glass-card" style={{ textAlign: 'center', padding: '60px 40px', color: 'var(--text-secondary)' }}>
          There are no hackathons currently open for registrations.
        </div>
      ) : (
        <div className="responsive-card-grid">
          {hackathons.map((hackathon) => {
            const statusDisplay = getStatusDisplay(hackathon.id)
            const isRegistered = registeredIds.has(hackathon.id)
            
            return (
              <div key={hackathon.id} className="glass-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', marginBottom: '16px' }}>
                    <h3 style={{ fontSize: '18px', color: 'var(--text-primary)' }}>{hackathon.name}</h3>
                    {isRegistered && statusDisplay && (
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '4px 10px',
                        borderRadius: '20px',
                        fontSize: '12px',
                        fontWeight: 600,
                        background: statusDisplay.bg,
                        color: statusDisplay.color,
                        border: statusDisplay.border
                      }}>
                        {statusDisplay.icon} {statusDisplay.text}
                      </span>
                    )}
                  </div>
                  
                  <p style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: '1.6', marginBottom: '20px' }}>
                    {hackathon.description || 'No description provided.'}
                  </p>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '24px' }}>
                    <p><strong>Theme:</strong> <span style={{ color: 'var(--text-primary)' }}>{hackathon.theme || 'Open Innovation'}</span></p>
                    <p><strong>Registration Deadline:</strong> {new Date(hackathon.registration_deadline).toLocaleDateString()}</p>
                    <p><strong>Max Team Limit:</strong> {hackathon.max_team_size} members</p>
                  </div>
                </div>

                <div>
                  {isRegistered ? (
                    <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                      <button disabled className="btn btn-secondary" style={{ flex: 1, padding: '10px' }}>
                        Registered
                      </button>
                      {statusDisplay?.text === 'Confirmed' && (
                        <button 
                          onClick={() => {
                            setSelectedHackathon(hackathon)
                            setShowTeamModal(true)
                          }}
                          className="btn btn-success"
                          style={{ flex: 1, padding: '10px' }}
                        >
                          <PlusCircle size={16} /> Create Team
                        </button>
                      )}
                    </div>
                  ) : (
                    <button 
                      onClick={() => handleRegister(hackathon.id)}
                      disabled={actionLoading}
                      className="btn btn-primary"
                      style={{ width: '100%', padding: '12px', marginTop: '10px' }}
                    >
                      {actionLoading ? 'Registering...' : 'Register for Hackathon'}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Create Team Modal */}
      {showTeamModal && (
        <div className="modal-overlay">
          <div className="glass-card" style={{ width: '100%', maxWidth: '440px', padding: '32px' }}>
            <h2 style={{ fontSize: '20px', marginBottom: '8px', fontFamily: 'var(--font-display)' }}>Create Hackathon Team</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '24px' }}>Establish a new team for {selectedHackathon?.name}.</p>
            
            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontWeight: 600, fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px' }}>Team Name</label>
              <input 
                type="text" 
                placeholder="e.g. Code Ninjas" 
                value={teamName} 
                onChange={(e) => setTeamName(e.target.value)} 
                className="premium-input" 
              />
            </div>
            
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowTeamModal(false)} className="btn btn-secondary" style={{ padding: '8px 16px' }}>Cancel</button>
              <button onClick={handleCreateTeam} disabled={actionLoading} className="btn btn-primary" style={{ padding: '8px 20px' }}>
                {actionLoading ? 'Creating...' : 'Create Team'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manage Team Modal */}
      {showManageModal && selectedTeam && (
        <div className="modal-overlay">
          <div className="glass-card" style={{ width: '100%', maxWidth: '520px', padding: '32px' }}>
            <h2 style={{ fontSize: '20px', marginBottom: '8px', fontFamily: 'var(--font-display)' }}>Manage Team: {selectedTeam.team_name}</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '24px' }}>Invite members and manage team roster details.</p>
            
            <div style={{ marginBottom: '20px', padding: '16px', background: 'rgba(0,0,0,0.02)', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
              <p style={{ fontSize: '14px' }}><strong>Team Lead:</strong> <span style={{ color: 'var(--primary)' }}>{user?.email}</span></p>
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontWeight: 600, fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px' }}>Nominate Member via Email</label>
              <div style={{ display: 'flex', gap: '10px' }}>
                <input 
                  type="email" 
                  placeholder="student@college.edu" 
                  value={inviteEmail} 
                  onChange={(e) => setInviteEmail(e.target.value)} 
                  className="premium-input" 
                />
                <button onClick={handleInviteMember} className="btn btn-primary" style={{ padding: '0 20px' }}>Invite</button>
              </div>
            </div>

            <h3 style={{ fontSize: '15px', color: 'var(--text-primary)', marginBottom: '12px' }}>Active Members ({teamMembers.length})</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '180px', overflowY: 'auto', marginBottom: '24px' }}>
              {teamMembers.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Only you are in this team. Invite members above.</p>
              ) : (
                teamMembers.map(m => (
                  <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'rgba(0,0,0,0.01)', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
                    <div style={{ fontSize: '13px' }}>
                      <p style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{m.full_name || 'No Name'}</p>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>{m.email}</p>
                    </div>
                    {m.id !== user?.id && (
                      <button 
                        onClick={() => handleRemoveMember(m.id)} 
                        className="btn btn-secondary" 
                        style={{ padding: '4px 8px', fontSize: '11px', borderColor: 'rgba(239, 68, 68, 0.2)', color: 'var(--danger)' }}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowManageModal(false)} className="btn btn-secondary" style={{ padding: '10px 24px' }}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Submit Project Modal */}
      {showSubmitModal && (
        <div className="modal-overlay">
          <div className="glass-card" style={{ width: '100%', maxWidth: '560px', padding: '32px' }}>
            <h2 style={{ fontSize: '20px', marginBottom: '8px', fontFamily: 'var(--font-display)' }}>Submit Hackathon Project</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '24px' }}>Submit files and repository pointers for {selectedHackathon?.name}.</p>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
              <div>
                <label style={{ display: 'block', fontWeight: 600, fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px' }}>Project Title *</label>
                <input 
                  type="text" 
                  placeholder="e.g. AI-driven Smart Health Assistant" 
                  value={submissionForm.project_title} 
                  onChange={(e) => setSubmissionForm({...submissionForm, project_title: e.target.value})} 
                  className="premium-input" 
                />
              </div>
              
              <div>
                <label style={{ display: 'block', fontWeight: 600, fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px' }}>Problem Statement</label>
                <textarea
                  placeholder="What problem are you solving?"
                  value={submissionForm.problem_statement}
                  onChange={(e) => setSubmissionForm({...submissionForm, problem_statement: e.target.value})}
                  rows={2}
                  className="premium-input"
                />
              </div>

              <div>
                <label style={{ display: 'block', fontWeight: 600, fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px' }}>Solution & Tech Stack</label>
                <textarea
                  placeholder="Highlight your approach, technology stack, and architecture..."
                  value={submissionForm.solution}
                  onChange={(e) => setSubmissionForm({...submissionForm, solution: e.target.value})}
                  rows={4}
                  className="premium-input"
                />
              </div>

              <div>
                <label style={{ display: 'block', fontWeight: 600, fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px' }}>Key Features</label>
                <textarea
                  placeholder="List the standout features of your project..."
                  value={submissionForm.features}
                  onChange={(e) => setSubmissionForm({...submissionForm, features: e.target.value})}
                  rows={2}
                  className="premium-input"
                />
              </div>

              <div>
                <label style={{ display: 'block', fontWeight: 600, fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px' }}>GitHub / Repository Link</label>
                <input 
                  type="url" 
                  placeholder="https://github.com/username/project" 
                  value={submissionForm.repo_link} 
                  onChange={(e) => setSubmissionForm({...submissionForm, repo_link: e.target.value})} 
                  className="premium-input" 
                />
              </div>
              
              <div>
                <label style={{ display: 'block', fontWeight: 600, fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px' }}>Demo Video URL</label>
                <input 
                  type="url" 
                  placeholder="https://youtube.com/watch?v=..." 
                  value={submissionForm.demo_video_url} 
                  onChange={(e) => setSubmissionForm({...submissionForm, demo_video_url: e.target.value})} 
                  className="premium-input" 
                />
              </div>

              <div>
                <label style={{ display: 'block', fontWeight: 600, fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px' }}>PPT / Slide Link</label>
                <input 
                  type="url" 
                  placeholder="e.g. Google Slides, Canva pitch presentation link" 
                  value={submissionForm.ppt_url} 
                  onChange={(e) => setSubmissionForm({...submissionForm, ppt_url: e.target.value})} 
                  className="premium-input" 
                />
              </div>

              <div>
                <label style={{ display: 'block', fontWeight: 600, fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px' }}>PDF / Documentation Link</label>
                <input
                  type="url"
                  placeholder="e.g. Project report document PDF link"
                  value={submissionForm.report_pdf_url}
                  onChange={(e) => setSubmissionForm({...submissionForm, report_pdf_url: e.target.value})}
                  className="premium-input"
                />
              </div>
            </div>
            
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowSubmitModal(false)} className="btn btn-secondary" style={{ padding: '10px 20px' }}>Cancel</button>
              <button onClick={handleSubmitProject} disabled={actionLoading} className="btn btn-primary" style={{ padding: '10px 24px' }}>
                <Send size={14} /> {actionLoading ? 'Submitting...' : 'Submit Project'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}