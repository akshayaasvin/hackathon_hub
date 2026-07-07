'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Calendar } from 'lucide-react'
import { withTimeout } from '@/lib/utils'
import { RegistrationStatusChip, type RegistrationStatusValue } from '@/components/participant/RegistrationStatusChip'

export default function ParticipantDashboard() {
  const [user, setUser] = useState<any>(null)
  const [hackathons, setHackathons] = useState<any[]>([])
  const [statusByHackathon, setStatusByHackathon] = useState<Map<string, RegistrationStatusValue>>(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [showWinnerAlert, setShowWinnerAlert] = useState(false)
  const [winnerMessage, setWinnerMessage] = useState('')

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

      const [hackathonsRes, registrationsRes, teamsRes] = await withTimeout(
        Promise.all([
          supabase.from('hackathons').select('*').eq('status', 'published'),
          supabase.from('registrations').select('hackathon_id, status').eq('user_id', user.id),
          supabase.from('teams').select('*, hackathons(name)').eq('team_lead_id', user.id)
        ]),
        5000
      )

      if (hackathonsRes.error) throw hackathonsRes.error
      if (registrationsRes.error) throw registrationsRes.error
      if (teamsRes.error) throw teamsRes.error

      setHackathons(hackathonsRes.data || [])

      const statusMap = new Map<string, RegistrationStatusValue>()
      for (const reg of registrationsRes.data || []) {
        statusMap.set(reg.hackathon_id, (reg.status as RegistrationStatusValue) || 'registered')
      }
      setStatusByHackathon(statusMap)

      const teams = teamsRes.data || []

      if (teams.length > 0) {
        const teamIds = teams.map((t: any) => t.id)
        const { data: winnersData, error: winnersError } = await withTimeout(
          supabase.from('winners').select('team_id, rank, prize_amount').in('team_id', teamIds),
          5000
        )
        if (winnersError) throw winnersError

        if (winnersData && winnersData.length > 0) {
          for (const winner of winnersData) {
            const team = teams.find((t: any) => t.id === winner.team_id)
            if (team && !localStorage.getItem(`winner_alert_${team.id}`)) {
              localStorage.setItem(`winner_alert_${team.id}`, 'shown')
              setWinnerMessage(`🎉 CONGRATULATIONS! 🎉\n\nYour team "${team.team_name}" ranked #${winner.rank} 🏆\nand won a cash prize of $${winner.prize_amount}!\n\nNavigate to the Certificates page to download your certificate.`)
              setShowWinnerAlert(true)
              break
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
            <div style={{ fontSize: '72px', marginBottom: '24px' }}>🏆</div>
            <h2 style={{ color: 'var(--secondary)', fontSize: '32px', fontFamily: 'var(--font-display)', marginBottom: '20px' }}>
              VICTORY DECLARED!
            </h2>
            <p style={{ color: 'var(--text-primary)', fontSize: '16px', lineHeight: '1.6', whiteSpace: 'pre-line', marginBottom: '32px' }}>
              {winnerMessage}
            </p>
            <button onClick={() => setShowWinnerAlert(false)} className="btn btn-success" style={{ padding: '12px 32px' }}>
              Claim Achievement
            </button>
          </div>
        </div>
      )}

      <div style={{ marginBottom: '40px' }}>
        <h1 style={{ fontSize: '32px', marginBottom: '8px', fontFamily: 'var(--font-display)' }}>Participant Dashboard</h1>
        <p style={{ color: 'var(--text-secondary)' }}>Welcome back, <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{user?.email}</span>. Track your registrations, teams, and submissions.</p>
      </div>

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
            const status: RegistrationStatusValue = statusByHackathon.get(hackathon.id) || 'not_registered'

            return (
              <div
                key={hackathon.id}
                onClick={() => router.push(`/participant/${hackathon.id}`)}
                className="glass-card"
                style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', overflow: 'hidden', cursor: 'pointer' }}
              >
                <div>
                  {hackathon.banner_url && (
                    <img
                      src={hackathon.banner_url}
                      alt={hackathon.name}
                      style={{ width: '100%', height: '160px', objectFit: 'cover', borderRadius: '10px', marginBottom: '16px' }}
                    />
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', marginBottom: '16px' }}>
                    <h3 style={{ fontSize: '18px', color: 'var(--text-primary)' }}>{hackathon.name}</h3>
                    <RegistrationStatusChip status={status} />
                  </div>

                  <p
                    style={{
                      color: 'var(--text-secondary)',
                      fontSize: '14px',
                      lineHeight: '1.6',
                      marginBottom: '20px',
                      display: '-webkit-box',
                      WebkitLineClamp: 4,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}
                  >
                    {hackathon.description || 'No description provided.'}
                  </p>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '24px' }}>
                    <p><strong>Theme:</strong> <span style={{ color: 'var(--text-primary)' }}>{hackathon.theme || 'Open Innovation'}</span></p>
                    <p><strong>Registration Deadline:</strong> {new Date(hackathon.registration_deadline).toLocaleDateString()}</p>
                    <p><strong>Max Team Limit:</strong> {hackathon.max_team_size} members</p>
                  </div>
                </div>

                <button className="btn btn-primary" style={{ width: '100%', padding: '12px' }}>
                  View Details
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
