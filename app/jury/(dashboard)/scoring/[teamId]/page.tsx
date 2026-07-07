'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Check, MessageSquare, Sliders, ArrowLeft } from 'lucide-react'

export default function ScoringPage() {
  const params = useParams()
  const router = useRouter()
  const teamId = params.teamId as string
  const supabase = createClient()

  const [user, setUser] = useState<any>(null)
  const [team, setTeam] = useState<any>(null)
  const [submission, setSubmission] = useState<any>(null)
  const [evaluation, setEvaluation] = useState<any>(null)
  const [scores, setScores] = useState({ innovation: 0, technical: 0, ux: 0, feasibility: 0, presentation: 0 })
  const [feedback, setFeedback] = useState('')
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadData()
  }, [teamId])

  const loadData = async () => {
    try {
      setLoading(true)
      setError(null)

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }
      setUser(user)

      const { data: teamData, error: teamError } = await supabase.from('teams').select('*').eq('id', teamId).single()
      if (teamError || !teamData) throw teamError || new Error('Team not found.')
      setTeam(teamData)

      const { data: submissionData } = await supabase.from('submissions').select('*').eq('team_id', teamId).single()
      setSubmission(submissionData)

      const { data: evaluationData } = await supabase
        .from('evaluations')
        .select('*')
        .eq('team_id', teamId)
        .eq('judge_id', user.id)
        .maybeSingle()

      if (evaluationData) {
        setEvaluation(evaluationData)
        setScores({
          innovation: evaluationData.innovation_score,
          technical: evaluationData.technical_score,
          ux: evaluationData.ux_score,
          feasibility: evaluationData.feasibility_score,
          presentation: evaluationData.presentation_score,
        })
        setFeedback(evaluationData.feedback || '')
      } else {
        setEvaluation(null)
        setScores({ innovation: 0, technical: 0, ux: 0, feasibility: 0, presentation: 0 })
        setFeedback('')
      }
    } catch (err: any) {
      console.error(err)
      setError(err.message || 'Failed to load submission for scoring.')
    } finally {
      setLoading(false)
    }
  }

  const calculateTotalScore = () =>
    (scores.innovation + scores.technical + scores.ux + scores.feasibility + scores.presentation).toFixed(2)

  const goBackToSubmissions = () => {
    router.push(`/jury/submissions?hackathon=${team?.hackathon_id}`)
  }

  const handleSubmitEvaluation = async () => {
    setActionLoading(true)

    if (evaluation) {
      const { error } = await supabase
        .from('evaluations')
        .update({
          innovation_score: scores.innovation,
          technical_score: scores.technical,
          ux_score: scores.ux,
          feasibility_score: scores.feasibility,
          presentation_score: scores.presentation,
          feedback,
          submitted_at: new Date().toISOString(),
        })
        .eq('id', evaluation.id)

      if (error) {
        alert('Error updating evaluation: ' + error.message)
      } else {
        alert('Evaluation updated successfully!')
        goBackToSubmissions()
      }
    } else {
      const { error } = await supabase.from('evaluations').insert({
        judge_id: user?.id,
        team_id: teamId,
        hackathon_id: team.hackathon_id,
        innovation_score: scores.innovation,
        technical_score: scores.technical,
        ux_score: scores.ux,
        feasibility_score: scores.feasibility,
        presentation_score: scores.presentation,
        feedback,
      })

      if (error) {
        alert('Error saving evaluation: ' + error.message)
      } else {
        alert('Evaluation saved successfully!')
        goBackToSubmissions()
      }
    }
    setActionLoading(false)
  }

  if (loading) {
    return <div style={{ padding: '100px 20px', textAlign: 'center', fontSize: '18px', color: 'var(--text-secondary)' }}>Loading Scoring...</div>
  }

  if (error || !submission) {
    return (
      <div className="premium-container fade-in" style={{ maxWidth: '600px', marginTop: '60px' }}>
        <div className="glass-card" style={{ borderLeft: '4px solid var(--danger)', padding: '32px', textAlign: 'center' }}>
          <h2 style={{ color: 'var(--danger)', fontSize: '20px', marginBottom: '12px' }}>⚠️ {error ? 'Loading Failure' : 'No submission yet'}</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '24px' }}>{error || 'This team has not submitted a project yet.'}</p>
          <button onClick={() => router.push('/jury')} className="btn btn-primary" style={{ padding: '10px 24px' }}>
            Back to Dashboard
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="premium-container fade-in" style={{ maxWidth: '760px' }}>
      <button
        onClick={goBackToSubmissions}
        className="btn btn-secondary"
        style={{ marginBottom: '20px', padding: '6px 14px', fontSize: '13px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
      >
        <ArrowLeft size={14} /> Back to Submissions
      </button>

      <div className="glass-card fade-in" style={{ padding: '36px' }}>
        <h2 style={{ fontSize: '22px', marginBottom: '4px', fontFamily: 'var(--font-display)' }}>Evaluate Project</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '24px' }}>
          Team: <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{team?.team_name}</span>
        </p>

        <div className="glass-card" style={{ padding: '20px', background: 'rgba(0,0,0,0.01)', border: '1px solid var(--border-color)', borderRadius: '12px', marginBottom: '28px' }}>
          <h4 style={{ fontSize: '15px', color: 'var(--text-primary)', marginBottom: '10px' }}>Submitted Assets</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '14px' }}>
            <p><strong>Title:</strong> <span style={{ color: 'var(--text-primary)' }}>{submission.project_title}</span></p>
            <p><strong>Problem Statement:</strong> <span style={{ color: 'var(--text-secondary)' }}>{submission.problem_statement || 'Not provided'}</span></p>
            <p><strong>Solution:</strong> <span style={{ color: 'var(--text-secondary)' }}>{submission.solution || 'Not provided'}</span></p>
            {submission.features && <p><strong>Key Features:</strong> <span style={{ color: 'var(--text-secondary)' }}>{submission.features}</span></p>}
            {submission.repo_link && <p><strong>GitHub:</strong> <a href={submission.repo_link} target="_blank" rel="noreferrer" style={{ color: 'var(--primary)', textDecoration: 'none' }}>{submission.repo_link}</a></p>}
            {submission.demo_video_url && <p><strong>Demo Video:</strong> <a href={submission.demo_video_url} target="_blank" rel="noreferrer" style={{ color: 'var(--primary)', textDecoration: 'none' }}>Watch Pitch Video</a></p>}
            {submission.ppt_url && <p><strong>PPT Slides:</strong> <a href={submission.ppt_url} target="_blank" rel="noreferrer" style={{ color: 'var(--primary)', textDecoration: 'none' }}>View PPT slides</a></p>}
            {submission.report_pdf_url && <p><strong>PDF Report:</strong> <a href={submission.report_pdf_url} target="_blank" rel="noreferrer" style={{ color: 'var(--primary)', textDecoration: 'none' }}>View Report PDF</a></p>}
          </div>
        </div>

        <h3 style={{ fontSize: '16px', color: 'var(--text-primary)', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Sliders size={18} color="var(--primary)" /> Evaluation Matrix
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '28px' }}>
          {[
            { key: 'innovation', label: 'Innovation', max: 25 },
            { key: 'technical', label: 'Technical Complexity', max: 25 },
            { key: 'ux', label: 'User Experience', max: 20 },
            { key: 'feasibility', label: 'Feasibility', max: 15 },
            { key: 'presentation', label: 'Presentation', max: 15 },
          ].map(({ key, label, max }) => (
            <div key={key}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '14px' }}>
                <strong>{label}</strong>
                <span style={{ color: 'var(--primary)', fontWeight: 600 }}>{(scores as any)[key]}/{max}</span>
              </div>
              <input
                type="range"
                min="0"
                max={max}
                value={(scores as any)[key]}
                onChange={(e) => setScores({ ...scores, [key]: parseInt(e.target.value) })}
                style={{ width: '100%', accentColor: 'var(--primary)' }}
              />
            </div>
          ))}
        </div>

        <div style={{ padding: '16px 20px', background: 'var(--primary-glow)', border: '1px solid var(--border-color)', borderRadius: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
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
          <button onClick={() => router.push('/jury')} className="btn btn-secondary" style={{ padding: '8px 16px', color: 'var(--text-secondary)' }}>
            Return to Dashboard
          </button>
          <button onClick={goBackToSubmissions} className="btn btn-secondary" style={{ padding: '8px 16px' }}>
            Return to Submissions
          </button>
          <button onClick={handleSubmitEvaluation} disabled={actionLoading} className="btn btn-primary" style={{ padding: '8px 24px' }}>
            <Check size={14} /> {actionLoading ? 'Saving...' : 'Save Scorecard'}
          </button>
        </div>
      </div>
    </div>
  )
}
