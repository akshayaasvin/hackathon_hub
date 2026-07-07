'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Users } from 'lucide-react'
import { withTimeout } from '@/lib/utils'

export default function MyTeamsPage() {
  const [myTeams, setMyTeams] = useState<any[]>([])
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

      const { data, error: teamsError } = await withTimeout(
        supabase.from('teams').select('*, hackathons(name)').eq('team_lead_id', user.id),
        5000
      )
      if (teamsError) throw teamsError
      setMyTeams(data || [])
    } catch (err: any) {
      console.error('Error loading teams:', err)
      setError(err.message || 'Failed to load your teams.')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div style={{ padding: '100px 20px', textAlign: 'center', fontSize: '18px', color: 'var(--text-secondary)' }}>Loading My Teams...</div>
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
      <div style={{ marginBottom: '40px' }}>
        <h1 style={{ fontSize: '32px', marginBottom: '8px', fontFamily: 'var(--font-display)' }}>My Teams</h1>
        <p style={{ color: 'var(--text-secondary)' }}>Teams you lead across all hackathons.</p>
      </div>

      {myTeams.length === 0 ? (
        <div className="glass-card" style={{ textAlign: 'center', padding: '60px 40px', color: 'var(--text-secondary)' }}>
          You haven't created a team yet. Register for a hackathon and get approved to create one.
        </div>
      ) : (
        <div className="responsive-card-grid">
          {myTeams.map((team) => (
            <div key={team.id} className="glass-card" style={{ borderLeft: '4px solid var(--primary)', padding: '24px' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                <Users size={12} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'text-bottom' }} /> TEAM MANAGER
              </span>
              <h3 style={{ fontSize: '20px', margin: '6px 0 12px 0', color: 'var(--text-primary)' }}>{team.team_name}</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '24px' }}>
                <strong>Hackathon:</strong> {team.hackathons?.name}
              </p>
              <button
                onClick={() => router.push(`/participant/${team.hackathon_id}`)}
                className="btn btn-primary"
                style={{ padding: '8px 16px', fontSize: '13px', width: '100%' }}
              >
                Open Hackathon
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
