'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Trophy } from 'lucide-react'

export default function CollegeLeaderboardPage() {
  const [leaderboard, setLeaderboard] = useState<any[]>([])
  const [myCollegeName, setMyCollegeName] = useState<string | null>(null)
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

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      const { data: myProfile } = await supabase.from('college_profiles').select('college_name').eq('user_id', user.id).maybeSingle()
      setMyCollegeName(myProfile?.college_name || null)

      const res = await fetch('/api/college/leaderboard')
      const json = await res.json()
      if (!json.success) throw new Error(json.message || 'Failed to load leaderboard.')

      setLeaderboard(json.data.leaderboard || [])
    } catch (err: any) {
      console.error('Error:', err)
      setError(err.message || 'Failed to load leaderboard.')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div style={{ padding: '100px 20px', textAlign: 'center', fontSize: '18px', color: 'var(--text-secondary)' }}>Loading Leaderboard...</div>
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

  return (
    <div className="premium-container fade-in" style={{ padding: '40px' }}>
      <div style={{ marginBottom: '36px' }}>
        <h1 style={{ fontSize: '32px', marginBottom: '8px', fontFamily: 'var(--font-display)' }}>Top Performing Colleges</h1>
        <p style={{ color: 'var(--text-secondary)' }}>Ranked by total evaluation score across all published results. Updates automatically as results are announced.</p>
      </div>

      {leaderboard.length === 0 ? (
        <div className="glass-card" style={{ textAlign: 'center', padding: '60px 40px', color: 'var(--text-secondary)' }}>
          No results have been published yet.
        </div>
      ) : (
        <div className="table-container fade-in">
          <table className="premium-table">
            <thead>
              <tr>
                <th>Rank</th>
                <th>College</th>
                <th>Participants</th>
                <th>Teams</th>
                <th>Total Score</th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.map((col, idx) => (
                <tr key={col.collegeName} style={col.collegeName === myCollegeName ? { background: 'rgba(99, 102, 241, 0.06)' } : undefined}>
                  <td style={{ fontWeight: 700 }}>
                    {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`}
                  </td>
                  <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                    {col.collegeName}
                    {col.collegeName === myCollegeName && (
                      <span style={{ marginLeft: '8px', fontSize: '11px', color: 'var(--primary)', fontWeight: 600 }}>(You)</span>
                    )}
                  </td>
                  <td>{col.participantCount}</td>
                  <td>{col.teamsCount}</td>
                  <td style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Trophy size={14} color="var(--warning)" /> {col.totalScore}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
