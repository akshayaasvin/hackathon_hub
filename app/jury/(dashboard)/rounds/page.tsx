'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { postJson } from '@/lib/apiFetch'
import { ArrowLeft, ExternalLink } from 'lucide-react'
import { withTimeout } from '@/lib/utils'

// Judge-facing Round 1 / Round 2 scoring — a NEW page rather than reusing
// /jury/(dashboard)/scoring/[teamId] (the existing evaluations-based scorecard UI), since that
// page and the `evaluations` table it writes to are a separate, untouched flow. This page
// writes to round_judge_scores via app/api/rounds/score/[teamId] instead — each judge's own
// score, never another judge's (the route always writes the CALLER's row). team_round_status
// (attendance/shortlist/position) stays admin-only; a judge here only ever scores.
function RoundScoringContent() {
  const [hackathon, setHackathon] = useState<any>(null)
  const [round, setRound] = useState<1 | 2>(1)
  const [teams, setTeams] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [savingTeamId, setSavingTeamId] = useState<string | null>(null)
  const [drafts, setDrafts] = useState<Record<string, { score: string; remarks: string }>>({})
  const router = useRouter()
  const searchParams = useSearchParams()
  const hackathonId = searchParams.get('hackathon')
  const supabase = createClient()

  useEffect(() => {
    loadData()
  }, [hackathonId, round])

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

      const { data: myAssignments } = await supabase
        .from('judge_assignments')
        .select('team_id')
        .eq('hackathon_id', hackathonId)
        .eq('judge_id', user.id)
      const assignedTeamIds = [...new Set((myAssignments || []).map((a: any) => a.team_id))]
      if (assignedTeamIds.length === 0) {
        setTeams([])
        return
      }

      const [{ data: teamsData }, { data: submissions }, { data: statuses }, { data: myScores }] = await withTimeout(
        Promise.all([
          supabase.from('teams').select('id, team_name').in('id', assignedTeamIds),
          supabase.from('submissions').select('*').in('team_id', assignedTeamIds).eq('round', round),
          supabase.from('team_round_status').select('*').in('team_id', assignedTeamIds).eq('round', round === 2 ? 1 : round),
          supabase.from('round_judge_scores').select('*').in('team_id', assignedTeamIds).eq('round', round).eq('judge_id', user.id),
        ]),
        5000
      )

      // Round 2 only ever scores teams that were actually shortlisted in Round 1 — a judge
      // never gets a scoring row for a team that didn't make it through.
      const eligibleTeamIds = round === 1
        ? assignedTeamIds
        : assignedTeamIds.filter((id) => (statuses || []).find((s: any) => s.team_id === id)?.shortlisted)

      const rows = (teamsData || [])
        .filter((t: any) => eligibleTeamIds.includes(t.id))
        .map((t: any) => ({
          ...t,
          submission: (submissions || []).find((s: any) => s.team_id === t.id) || null,
          myScore: (myScores || []).find((s: any) => s.team_id === t.id) || null,
        }))
      setTeams(rows)

      const nextDrafts: Record<string, { score: string; remarks: string }> = {}
      for (const t of rows) {
        nextDrafts[t.id] = { score: t.myScore?.score != null ? String(t.myScore.score) : '', remarks: t.myScore?.remarks || '' }
      }
      setDrafts(nextDrafts)
    } catch (err: any) {
      console.error(err)
      setError(err.message || 'Failed to load round scoring data.')
    } finally {
      setLoading(false)
    }
  }

  const saveScore = async (teamId: string) => {
    const draft = drafts[teamId]
    const score = Number(draft?.score)
    if (!draft?.score || !Number.isFinite(score) || score < 0 || score > 100) {
      alert('Enter a score between 0 and 100.')
      return
    }
    setSavingTeamId(teamId)
    const res = await postJson(`/api/rounds/score/${teamId}`, { round, score, remarks: draft.remarks })
    setSavingTeamId(null)
    if (!res.success) return alert(res.message)
    await loadData()
  }

  if (loading) {
    return <div style={{ padding: '100px 20px', textAlign: 'center', fontSize: '18px', color: 'var(--text-secondary)' }}>Loading…</div>
  }

  if (error) {
    return (
      <div className="premium-container fade-in" style={{ maxWidth: '600px', marginTop: '60px' }}>
        <div className="glass-card" style={{ borderLeft: '4px solid var(--danger)', padding: '32px', textAlign: 'center' }}>
          <h2 style={{ color: 'var(--danger)', fontSize: '20px', marginBottom: '12px' }}>⚠️ {error}</h2>
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
        <ArrowLeft size={16} /> Back to Dashboard
      </button>

      <h2 style={{ fontSize: '22px', marginBottom: '8px', fontFamily: 'var(--font-display)' }}>
        Round Scoring — {hackathon?.name}
      </h2>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '20px', fontSize: '14px' }}>
        Scores you submit here are your own — other judges' scores are averaged by the admin and never overwritten.
      </p>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
        <button onClick={() => setRound(1)} className={round === 1 ? 'btn btn-primary' : 'btn btn-secondary'} style={{ padding: '8px 20px' }}>
          Round 1 — Shortlist
        </button>
        <button onClick={() => setRound(2)} className={round === 2 ? 'btn btn-primary' : 'btn btn-secondary'} style={{ padding: '8px 20px' }}>
          Round 2 — Demo
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {teams.length === 0 ? (
          <div className="glass-card" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
            {round === 2 ? 'No shortlisted teams assigned to you yet.' : 'No teams assigned to you for this hackathon.'}
          </div>
        ) : (
          teams.map((team) => (
            <div key={team.id} className="glass-card" style={{ borderLeft: team.myScore ? '4px solid var(--success)' : '4px solid var(--border-color)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: '12px' }}>
                <h3 style={{ fontSize: '17px', color: 'var(--text-primary)' }}>{team.team_name}</h3>
                {round === 1 && team.submission?.presentation_url && (
                  <a href={team.submission.presentation_url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)', fontSize: '13px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    View PPT <ExternalLink size={12} />
                  </a>
                )}
                {round === 2 && (
                  <div style={{ display: 'flex', gap: '12px', fontSize: '13px' }}>
                    {team.submission?.repo_link && <a href={team.submission.repo_link} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)' }}>GitHub</a>}
                    {team.submission?.live_demo_url && <a href={team.submission.live_demo_url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)' }}>Live Demo</a>}
                    {team.submission?.demo_video_url && <a href={team.submission.demo_video_url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)' }}>Video</a>}
                  </div>
                )}
              </div>
              {!team.submission && (
                <p style={{ fontSize: '13px', color: 'var(--warning)', marginBottom: '12px' }}>This team hasn't submitted for Round {round} yet — you can still score, but there's nothing to review.</p>
              )}
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600, fontSize: '13px', color: 'var(--text-secondary)' }}>Score (0-100)</label>
                  <input
                    type="number" min="0" max="100" className="premium-input" style={{ width: '90px' }}
                    value={drafts[team.id]?.score ?? ''}
                    onChange={(e) => setDrafts({ ...drafts, [team.id]: { ...drafts[team.id], score: e.target.value, remarks: drafts[team.id]?.remarks ?? '' } })}
                  />
                </div>
                <div style={{ flex: 1, minWidth: '200px' }}>
                  <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600, fontSize: '13px', color: 'var(--text-secondary)' }}>Remarks (optional)</label>
                  <input
                    className="premium-input" style={{ width: '100%' }}
                    value={drafts[team.id]?.remarks ?? ''}
                    onChange={(e) => setDrafts({ ...drafts, [team.id]: { ...drafts[team.id], remarks: e.target.value, score: drafts[team.id]?.score ?? '' } })}
                  />
                </div>
                <button onClick={() => saveScore(team.id)} disabled={savingTeamId === team.id} className="btn btn-primary" style={{ padding: '10px 20px' }}>
                  {savingTeamId === team.id ? 'Saving…' : team.myScore ? 'Update Score' : 'Save Score'}
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export default function JuryRoundsPage() {
  return (
    <Suspense fallback={<div style={{ padding: '100px 20px', textAlign: 'center', fontSize: '18px', color: 'var(--text-secondary)' }}>Loading...</div>}>
      <RoundScoringContent />
    </Suspense>
  )
}
