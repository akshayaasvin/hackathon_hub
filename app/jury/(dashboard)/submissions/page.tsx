'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft } from 'lucide-react'
import { withTimeout } from '@/lib/utils'

function AssignedSubmissionsContent() {
  const [hackathon, setHackathon] = useState<any>(null)
  const [teams, setTeams] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const searchParams = useSearchParams()
  const hackathonId = searchParams.get('hackathon')
  const supabase = createClient()

  useEffect(() => {
    loadData()
  }, [hackathonId])

  const loadData = async () => {
    if (!hackathonId) {
      setError('No hackathon selected. Go back to the Dashboard and pick one.')
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)

      const { data: { user } } = await withTimeout(supabase.auth.getUser(), 5000)
      if (!user) {
        router.push('/login')
        return
      }

      const { data: hackathonData } = await supabase.from('hackathons').select('*').eq('id', hackathonId).single()
      setHackathon(hackathonData)

      const { data: myAssignments, error: assignErr } = await supabase
        .from('judge_assignments')
        .select('team_id')
        .eq('hackathon_id', hackathonId)
        .eq('judge_id', user.id)

      if (assignErr) throw assignErr

      const assignedTeamIds = (myAssignments || []).map((a: any) => a.team_id)
      if (assignedTeamIds.length === 0) {
        setTeams([])
        return
      }

      const { data: teamsData, error: teamsErr } = await supabase
        .from('teams')
        .select('*, team_members(count)')
        .in('id', assignedTeamIds)

      if (teamsErr) throw teamsErr

      const teamIds = (teamsData || []).map((t: any) => t.id)

      const [submissionsRes, evaluationsRes] = await withTimeout(
        Promise.all([
          teamIds.length > 0
            ? supabase.from('submissions').select('*').in('team_id', teamIds)
            : Promise.resolve({ data: [] as any[] }),
          supabase.from('evaluations').select('*').eq('hackathon_id', hackathonId).eq('judge_id', user.id),
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

  if (loading) {
    return <div style={{ padding: '100px 20px', textAlign: 'center', fontSize: '18px', color: 'var(--text-secondary)' }}>Loading Assigned Submissions...</div>
  }

  if (error) {
    return (
      <div className="premium-container fade-in" style={{ maxWidth: '600px', marginTop: '60px' }}>
        <div className="glass-card" style={{ borderLeft: '4px solid var(--danger)', padding: '32px', textAlign: 'center' }}>
          <h2 style={{ color: 'var(--danger)', fontSize: '20px', marginBottom: '12px' }}>⚠️ Loading Failure</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '24px' }}>{error}</p>
          <button onClick={() => router.push('/jury')} className="btn btn-primary" style={{ padding: '10px 24px' }}>
            Back to Dashboard
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="premium-container fade-in">
      <button
        onClick={() => router.push('/jury')}
        className="btn btn-secondary"
        style={{ marginBottom: '28px', padding: '8px 16px', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
      >
        <ArrowLeft size={16} /> Back to Rounds
      </button>

      <h2 style={{ fontSize: '22px', marginBottom: '24px', fontFamily: 'var(--font-display)' }}>
        Evaluating Teams - {hackathon?.name}
      </h2>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {teams.length === 0 ? (
          <div className="glass-card" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
            No teams registered for this hackathon yet.
          </div>
        ) : (
          teams.map((team) => (
            <div
              key={team.id}
              className="glass-card"
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '20px',
                borderLeft: team.evaluation ? '4px solid var(--success)' : '4px solid var(--border-color)',
              }}
            >
              <div>
                <h3 style={{ fontSize: '18px', color: 'var(--text-primary)', marginBottom: '6px' }}>{team.team_name}</h3>
                <div style={{ display: 'flex', gap: '16px', fontSize: '13px', color: 'var(--text-secondary)', flexWrap: 'wrap' }}>
                  <p><strong>Submissions:</strong> <span style={{ color: team.submission ? 'var(--success)' : 'var(--danger)' }}>{team.submission ? '✅ Received' : '❌ Pending'}</span></p>
                  <p><strong>Status:</strong> <span style={{ color: team.evaluation ? 'var(--success)' : 'var(--warning)' }}>{team.evaluation ? 'Graded' : 'Unscored'}</span></p>
                  {team.evaluation && <p><strong>Total Score:</strong> <span style={{ color: 'var(--primary)', fontWeight: 700 }}>{team.evaluation.total_score}/100</span></p>}
                </div>
              </div>

              <button
                onClick={() => router.push(`/jury/scoring/${team.id}?hackathon=${hackathonId}`)}
                disabled={!team.submission}
                className={team.evaluation ? 'btn btn-secondary' : 'btn btn-primary'}
                style={{
                  padding: '8px 20px',
                  fontSize: '14px',
                  background: !team.submission ? 'var(--text-muted)' : undefined,
                  borderColor: !team.submission ? 'transparent' : undefined,
                }}
              >
                {team.evaluation ? 'Edit Scorecard' : (team.submission ? 'Score Project' : 'Awaiting Submission')}
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export default function AssignedSubmissionsPage() {
  return (
    <Suspense fallback={<div style={{ padding: '100px 20px', textAlign: 'center', fontSize: '18px', color: 'var(--text-secondary)' }}>Loading...</div>}>
      <AssignedSubmissionsContent />
    </Suspense>
  )
}
