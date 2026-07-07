'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Send } from 'lucide-react'
import { withTimeout } from '@/lib/utils'

export default function MySubmissionsPage() {
  const [submissions, setSubmissions] = useState<any[]>([])
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

      const { data: memberships } = await withTimeout(
        supabase.from('team_members').select('team_id').eq('user_id', user.id),
        5000
      )
      const teamIds = [...new Set((memberships || []).map((m: any) => m.team_id))]

      if (teamIds.length === 0) {
        setSubmissions([])
        return
      }

      const { data, error: subsError } = await withTimeout(
        supabase.from('submissions').select('*, teams(team_name, hackathon_id, hackathons(name))').in('team_id', teamIds),
        5000
      )
      if (subsError) throw subsError
      setSubmissions(data || [])
    } catch (err: any) {
      console.error('Error loading submissions:', err)
      setError(err.message || 'Failed to load your submissions.')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div style={{ padding: '100px 20px', textAlign: 'center', fontSize: '18px', color: 'var(--text-secondary)' }}>Loading Submissions...</div>
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
        <h1 style={{ fontSize: '32px', marginBottom: '8px', fontFamily: 'var(--font-display)' }}>Submissions</h1>
        <p style={{ color: 'var(--text-secondary)' }}>Projects submitted by teams you're a member of.</p>
      </div>

      {submissions.length === 0 ? (
        <div className="glass-card" style={{ textAlign: 'center', padding: '60px 40px', color: 'var(--text-secondary)' }}>
          No submissions yet. Once your team's registration is approved and you've formed a team, you can submit a project from the hackathon's detail page.
        </div>
      ) : (
        <div className="responsive-card-grid">
          {submissions.map((sub) => (
            <div key={sub.id} className="glass-card" style={{ borderLeft: '4px solid var(--primary)', padding: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                <Send size={16} color="var(--primary)" />
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {sub.teams?.hackathons?.name}
                </span>
              </div>
              <h3 style={{ fontSize: '18px', margin: '0 0 8px 0', color: 'var(--text-primary)' }}>{sub.project_title}</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '16px' }}>
                <strong>Team:</strong> {sub.teams?.team_name}
              </p>
              <span style={{
                display: 'inline-block',
                padding: '4px 10px',
                borderRadius: '20px',
                fontSize: '12px',
                fontWeight: 600,
                background: sub.status === 'submitted' ? 'rgba(59, 130, 246, 0.15)' : 'rgba(107, 114, 128, 0.15)',
                color: sub.status === 'submitted' ? '#2563eb' : '#6b7280',
              }}>
                {sub.status === 'submitted' ? 'Submitted' : 'Draft'}
              </span>
              <button
                onClick={() => router.push(`/participant/${sub.teams?.hackathon_id}`)}
                className="btn btn-secondary"
                style={{ width: '100%', padding: '10px', marginTop: '16px' }}
              >
                View in Hackathon
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
