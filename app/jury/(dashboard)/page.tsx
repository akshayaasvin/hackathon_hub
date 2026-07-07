'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Trophy } from 'lucide-react'
import { withTimeout } from '@/lib/utils'

export default function JuryDashboardPage() {
  const [user, setUser] = useState<any>(null)
  const [hackathons, setHackathons] = useState<any[]>([])
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

      // Only show hackathons where this jury member has been assigned teams
      const { data: assignments } = await withTimeout(
        supabase.from('judge_assignments').select('hackathon_id').eq('judge_id', user.id),
        5000
      )
      const hackathonIds = [...new Set((assignments || []).map((a: any) => a.hackathon_id))]

      const { data: hackathonData } = hackathonIds.length
        ? await withTimeout(supabase.from('hackathons').select('*').in('id', hackathonIds), 5000)
        : { data: [] as any[] }
      setHackathons(hackathonData || [])
    } catch (err: any) {
      console.error('Error:', err)
      setError(err.message || 'Failed to load jury dashboard. Connection timed out.')
    } finally {
      setLoading(false)
    }
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
        <h1 style={{ fontSize: '32px', marginBottom: '8px', fontFamily: 'var(--font-display)' }}>Jury Dashboard</h1>
        <p style={{ color: 'var(--text-secondary)' }}>Welcome back, Judge <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{user?.email}</span>. Evaluate team solution matrices and publish scorecard audits.</p>
      </div>

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
                onClick={() => router.push(`/jury/submissions?hackathon=${hackathon.id}`)}
                className="btn btn-primary"
                style={{ width: '100%', padding: '10px' }}
              >
                Evaluate Teams
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
