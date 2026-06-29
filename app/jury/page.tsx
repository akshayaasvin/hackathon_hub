'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../lib/supabase/client'
import { Star, Trophy, Users, Check, MessageSquare, Sliders, Play, ArrowLeft } from 'lucide-react'
import { withTimeout } from '../../lib/utils'

export default function JuryDashboard() {
  const [user, setUser] = useState<any>(null)
  const [hackathons, setHackathons] = useState<any[]>([])
  const [selectedHackathon, setSelectedHackathon] = useState<any>(null)
  const [teams, setTeams] = useState<any[]>([])
  const [selectedTeam, setSelectedTeam] = useState<any>(null)
  const [submission, setSubmission] = useState<any>(null)
  const [evaluation, setEvaluation] = useState<any>(null)
  const [showEvaluationModal, setShowEvaluationModal] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [scores, setScores] = useState({
    innovation: 0,
    technical: 0,
    impact: 0,
    ux: 0,
    presentation: 0
  })
  const [feedback, setFeedback] = useState('')
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

      // Get hackathons with 5s timeout
      const { data: hackathonData } = await withTimeout(
        supabase
          .from('hackathons')
          .select('*')
          .eq('status', 'published'),
        5000
      )
      setHackathons(hackathonData || [])
      
    } catch (err: any) {
      console.error('Error:', err)
      setError(err.message || 'Failed to load jury dashboard. Connection timed out.')
    } finally {
      setLoading(false)
    }
  }

  const loadTeamsForHackathon = async (hackathon: any) => {
    setSelectedHackathon(hackathon)
    setLoading(true)
    setError(null)
    
    try {
      const { data: teamsData, error: teamsErr } = await supabase
        .from('teams')
        .select('*, team_members(count)')
        .eq('hackathon_id', hackathon.id)
      
      if (teamsErr) throw teamsErr
      
      const teamIds = (teamsData || []).map((t: any) => t.id)

      const [submissionsRes, evaluationsRes] = await withTimeout(
        Promise.all([
          teamIds.length > 0 
            ? supabase.from('submissions').select('*').in('team_id', teamIds)
            : Promise.resolve({ data: [] }),
          supabase.from('evaluations').select('*').eq('hackathon_id', hackathon.id)
        ]),
        5000
      )
      
      const subsData = submissionsRes.data || []
      const evaluationsData = evaluationsRes.data || []

      const teamsWithSubmissions = (teamsData || []).map((team: any) => {
        const submission = subsData.find((s: any) => s.team_id === team.id) || null
        const evaluation = evaluationsData.find((e: any) => e.team_id === team.id) || null
        return { ...team, submission, evaluation }
      })
      
      setTeams(teamsWithSubmissions)
    } catch (err: any) {
      console.error(err)
      setError(err.message || 'Failed to load evaluation round data. Connection timed out.')
    } finally {
      setLoading(false)
    }
  }

  const loadTeamForEvaluation = async (team: any) => {
    setSelectedTeam(team)
    
    // Get submission
    const { data: submission } = await supabase
      .from('submissions')
      .select('*')
      .eq('team_id', team.id)
      .single()
    setSubmission(submission)
    
    // Get existing evaluation
    const { data: evaluation } = await supabase
      .from('evaluations')
      .select('*')
      .eq('team_id', team.id)
      .single()
    
    if (evaluation) {
      setEvaluation(evaluation)
      setScores({
        innovation: evaluation.innovation_score,
        technical: evaluation.technical_score,
        impact: evaluation.impact_score,
        ux: evaluation.ux_score,
        presentation: evaluation.presentation_score
      })
      setFeedback(evaluation.feedback || '')
    } else {
      setEvaluation(null)
      setScores({ innovation: 0, technical: 0, impact: 0, ux: 0, presentation: 0 })
      setFeedback('')
    }
    
    setShowEvaluationModal(true)
  }

  const calculateTotalScore = () => {
    return (
      scores.innovation * 0.25 +
      scores.technical * 0.25 +
      scores.impact * 0.20 +
      scores.ux * 0.15 +
      scores.presentation * 0.15
    ).toFixed(2)
  }

  const handleSubmitEvaluation = async () => {
    setActionLoading(true)
    const totalScore = Number(calculateTotalScore())
    
    if (evaluation) {
      // Update existing evaluation
      const { error } = await supabase
        .from('evaluations')
        .update({
          innovation_score: scores.innovation,
          technical_score: scores.technical,
          impact_score: scores.impact,
          ux_score: scores.ux,
          presentation_score: scores.presentation,
          total_score: totalScore,
          feedback: feedback,
          evaluated_at: new Date().toISOString()
        })
        .eq('id', evaluation.id)
      
      if (error) {
        alert('Error updating evaluation: ' + error.message)
      } else {
        alert('Evaluation updated successfully!')
        setShowEvaluationModal(false)
        loadTeamsForHackathon(selectedHackathon)
      }
    } else {
      // Create new evaluation
      const { error } = await supabase.from('evaluations').insert({
        judge_id: user?.id,
        team_id: selectedTeam.id,
        hackathon_id: selectedHackathon.id,
        innovation_score: scores.innovation,
        technical_score: scores.technical,
        impact_score: scores.impact,
        ux_score: scores.ux,
        presentation_score: scores.presentation,
        total_score: totalScore,
        feedback: feedback
      })
      
      if (error) {
        alert('Error saving evaluation: ' + error.message)
      } else {
        alert('Evaluation saved successfully!')
        setShowEvaluationModal(false)
        loadTeamsForHackathon(selectedHackathon)
      }
    }
    setActionLoading(false)
  }

  if (loading) {
    return <div style={{ padding: '100px 20px', textAlign: 'center', fontSize: '18px', color: 'var(--text-secondary)' }}>Loading Jury Dashboard...</div>
  }

  if (error) {
    return (
      <div className="premium-container fade-in" style={{ maxWidth: '600px', marginTop: '60px' }}>
        <div className="glass-card" style={{ borderLeft: '4px solid var(--danger)', padding: '32px', textAlign: 'center' }}>
          <h2 style={{ color: 'var(--danger)', fontSize: '20px', marginBottom: '12px' }}>⚠️ Loading Failure</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '24px' }}>{error}</p>
          <button onClick={selectedHackathon ? () => loadTeamsForHackathon(selectedHackathon) : loadData} className="btn btn-primary" style={{ padding: '10px 24px' }}>
            Retry Loading
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="premium-container fade-in">
      {/* Header */}
      <div style={{ marginBottom: '40px' }}>
        <h1 style={{ fontSize: '32px', marginBottom: '8px', fontFamily: 'var(--font-display)' }}>Jury Dashboard</h1>
        <p style={{ color: 'var(--text-secondary)' }}>Welcome back, Judge <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{user?.email}</span>. Evaluate team solution matrices and publish scorecard audits.</p>
      </div>

      {!selectedHackathon ? (
        <>
          <h2 style={{ fontSize: '20px', marginBottom: '20px', fontFamily: 'var(--font-display)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Trophy size={20} color="var(--warning)" /> Active Evaluation Rounds
          </h2>
          <div className="responsive-card-grid">
            {hackathons.length === 0 ? (
              <div className="glass-card" style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '60px 40px', color: 'var(--text-secondary)' }}>
                No active hackathons available for evaluation.
              </div>
            ) : (
              hackathons.map((hackathon) => (
                <div key={hackathon.id} className="glass-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div>
                    <h3 style={{ fontSize: '18px', color: 'var(--text-primary)', marginBottom: '10px' }}>{hackathon.name}</h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: '1.5', marginBottom: '20px' }}>
                      {hackathon.description || 'No description provided.'}
                    </p>
                  </div>
                  <button 
                    onClick={() => loadTeamsForHackathon(hackathon)}
                    className="btn btn-primary"
                    style={{ width: '100%', padding: '10px' }}
                  >
                    Evaluate Teams
                  </button>
                </div>
              ))
            )}
          </div>
        </>
      ) : (
        <div className="fade-in">
          <button 
            onClick={() => setSelectedHackathon(null)}
            className="btn btn-secondary"
            style={{ marginBottom: '28px', padding: '8px 16px', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
          >
            <ArrowLeft size={16} /> Back to Rounds
          </button>
          
          <h2 style={{ fontSize: '22px', marginBottom: '24px', fontFamily: 'var(--font-display)' }}>
            Evaluating Teams - {selectedHackathon.name}
          </h2>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {teams.length === 0 ? (
              <div className="glass-card" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
                No teams registered for this hackathon yet.
              </div>
            ) : (
              teams.map((team) => (
                <div key={team.id} className="glass-card" style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center', 
                  flexWrap: 'wrap',
                  gap: '20px',
                  borderLeft: team.evaluation ? '4px solid var(--success)' : '4px solid var(--border-color)'
                }}>
                  <div>
                    <h3 style={{ fontSize: '18px', color: 'var(--text-primary)', marginBottom: '6px' }}>{team.team_name}</h3>
                    <div style={{ display: 'flex', gap: '16px', fontSize: '13px', color: 'var(--text-secondary)', flexWrap: 'wrap' }}>
                      <p><strong>Submissions:</strong> <span style={{ color: team.submission ? 'var(--success)' : 'var(--danger)' }}>{team.submission ? '✅ Received' : '❌ Pending'}</span></p>
                      <p><strong>Status:</strong> <span style={{ color: team.evaluation ? 'var(--success)' : 'var(--warning)' }}>{team.evaluation ? 'Graded' : 'Unscored'}</span></p>
                      {team.evaluation && <p><strong>Total Score:</strong> <span style={{ color: 'var(--primary)', fontWeight: 700 }}>{team.evaluation.total_score}/100</span></p>}
                    </div>
                  </div>
                  
                  <button 
                    onClick={() => loadTeamForEvaluation(team)}
                    disabled={!team.submission}
                    className={team.evaluation ? "btn btn-secondary" : "btn btn-primary"}
                    style={{ 
                      padding: '8px 20px', 
                      fontSize: '14px',
                      background: !team.submission ? 'var(--text-muted)' : undefined,
                      borderColor: !team.submission ? 'transparent' : undefined
                    }}
                  >
                    {team.evaluation ? 'Edit Scorecard' : (team.submission ? 'Score Project' : 'Awaiting Submission')}
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
      
      {/* Evaluation Modal */}
      {showEvaluationModal && submission && (
        <div className="modal-overlay">
          <div className="glass-card fade-in" style={{ width: '100%', maxWidth: '680px', maxHeight: '90vh', overflowY: 'auto', padding: '36px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <button 
                onClick={() => setShowEvaluationModal(false)} 
                className="btn btn-secondary" 
                style={{ padding: '4px 10px', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
              >
                <ArrowLeft size={12} /> Back
              </button>
            </div>
            <h2 style={{ fontSize: '22px', marginBottom: '4px', fontFamily: 'var(--font-display)' }}>Evaluate Project</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '24px' }}>Team: <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{selectedTeam?.team_name}</span></p>
            
            {/* Submission metadata info card */}
            <div className="glass-card" style={{ padding: '20px', background: 'rgba(0,0,0,0.01)', border: '1px solid var(--border-color)', borderRadius: '12px', marginBottom: '28px' }}>
              <h4 style={{ fontSize: '15px', color: 'var(--text-primary)', marginBottom: '10px' }}>Submitted Assets</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '14px' }}>
                <p><strong>Title:</strong> <span style={{ color: 'var(--text-primary)' }}>{submission.project_title}</span></p>
                <p><strong>Pitch:</strong> <span style={{ color: 'var(--text-secondary)' }}>{submission.project_description || 'No pitch document'}</span></p>
                {submission.repo_link && (
                  <p><strong>GitHub:</strong> <a href={submission.repo_link} target="_blank" rel="noreferrer" style={{ color: 'var(--primary)', textDecoration: 'none' }}>{submission.repo_link}</a></p>
                )}
                {submission.demo_video_url && (
                  <p><strong>Demo Video:</strong> <a href={submission.demo_video_url} target="_blank" rel="noreferrer" style={{ color: 'var(--primary)', textDecoration: 'none' }}>Watch Pitch Video</a></p>
                )}
                {submission.ppt_url && (() => {
                  let ppt = ''
                  let pdf = ''
                  try {
                    if (submission.ppt_url.startsWith('{')) {
                      const parsed = JSON.parse(submission.ppt_url)
                      ppt = parsed.ppt || ''
                      pdf = parsed.pdf || ''
                    } else {
                      ppt = submission.ppt_url
                    }
                  } catch (e) {
                    ppt = submission.ppt_url
                  }
                  return (
                    <>
                      {ppt && (
                        <p><strong>PPT Slides:</strong> <a href={ppt} target="_blank" rel="noreferrer" style={{ color: 'var(--primary)', textDecoration: 'none' }}>View PPT slides</a></p>
                      )}
                      {pdf && (
                        <p><strong>PDF Document:</strong> <a href={pdf} target="_blank" rel="noreferrer" style={{ color: 'var(--primary)', textDecoration: 'none' }}>View Solution PDF</a></p>
                      )}
                    </>
                  )
                })()}
              </div>
            </div>
            
            <h3 style={{ fontSize: '16px', color: 'var(--text-primary)', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Sliders size={18} color="var(--primary)" /> Evaluation Matrix
            </h3>
            
            {/* Scores sliders */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '28px' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '14px' }}>
                  <strong>Innovation (25%)</strong>
                  <span style={{ color: 'var(--primary)', fontWeight: 600 }}>{scores.innovation}/100</span>
                </div>
                <input 
                  type="range" 
                  min="0" 
                  max="100" 
                  value={scores.innovation} 
                  onChange={(e) => setScores({...scores, innovation: parseInt(e.target.value)})}
                  style={{ width: '100%', accentColor: 'var(--primary)' }}
                />
              </div>
              
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '14px' }}>
                  <strong>Technical Complexity (25%)</strong>
                  <span style={{ color: 'var(--primary)', fontWeight: 600 }}>{scores.technical}/100</span>
                </div>
                <input 
                  type="range" 
                  min="0" 
                  max="100" 
                  value={scores.technical} 
                  onChange={(e) => setScores({...scores, technical: parseInt(e.target.value)})}
                  style={{ width: '100%', accentColor: 'var(--primary)' }}
                />
              </div>
              
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '14px' }}>
                  <strong>Impact (20%)</strong>
                  <span style={{ color: 'var(--primary)', fontWeight: 600 }}>{scores.impact}/100</span>
                </div>
                <input 
                  type="range" 
                  min="0" 
                  max="100" 
                  value={scores.impact} 
                  onChange={(e) => setScores({...scores, impact: parseInt(e.target.value)})}
                  style={{ width: '100%', accentColor: 'var(--primary)' }}
                />
              </div>
              
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '14px' }}>
                  <strong>Documentation (15%)</strong>
                  <span style={{ color: 'var(--primary)', fontWeight: 600 }}>{scores.ux}/100</span>
                </div>
                <input 
                  type="range" 
                  min="0" 
                  max="100" 
                  value={scores.ux} 
                  onChange={(e) => setScores({...scores, ux: parseInt(e.target.value)})}
                  style={{ width: '100%', accentColor: 'var(--primary)' }}
                />
              </div>
              
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '14px' }}>
                  <strong>Presentation (15%)</strong>
                  <span style={{ color: 'var(--primary)', fontWeight: 600 }}>{scores.presentation}/100</span>
                </div>
                <input 
                  type="range" 
                  min="0" 
                  max="100" 
                  value={scores.presentation} 
                  onChange={(e) => setScores({...scores, presentation: parseInt(e.target.value)})}
                  style={{ width: '100%', accentColor: 'var(--primary)' }}
                />
              </div>
            </div>
            
            {/* Total score box */}
            <div style={{ 
              padding: '16px 20px', 
              background: 'var(--primary-glow)', 
              border: '1px solid var(--border-color)', 
              borderRadius: '10px', 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              marginBottom: '24px'
            }}>
              <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Weighted Audit Score</span>
              <strong style={{ fontSize: '20px', color: 'var(--text-primary)' }}>{calculateTotalScore()} / 100.00</strong>
            </div>
            
            <div style={{ marginBottom: '28px' }}>
              <label style={{ display: 'block', fontWeight: 600, fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                <MessageSquare size={14} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'text-bottom' }} /> Audit Comments
              </label>
              <textarea 
                value={feedback} 
                onChange={(e) => setFeedback(e.target.value)} 
                rows={3}
                placeholder="Detail strengths, feedback, or items for improvement..."
                className="premium-input"
              />
            </div>
            
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <button 
                onClick={() => {
                  setShowEvaluationModal(false);
                  setSelectedHackathon(null);
                }} 
                className="btn btn-secondary" 
                style={{ padding: '8px 16px', color: 'var(--text-secondary)' }}
              >
                Return to Dashboard
              </button>
              <button 
                onClick={() => setShowEvaluationModal(false)} 
                className="btn btn-secondary" 
                style={{ padding: '8px 16px' }}
              >
                Return to Submissions
              </button>
              <button 
                onClick={handleSubmitEvaluation} 
                disabled={actionLoading} 
                className="btn btn-primary" 
                style={{ padding: '8px 24px' }}
              >
                <Check size={14} /> {actionLoading ? 'Saving...' : 'Save Scorecard'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}