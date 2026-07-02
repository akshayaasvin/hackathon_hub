'use client'

import { useEffect, useState } from 'react'
import { createClient } from '../../../lib/supabase/client'
import { Trophy, ArrowLeft, Award, Sparkles } from 'lucide-react'

export default function AdminResultsPage() {
  const [hackathons, setHackathons] = useState<any[]>([])
  const [selectedHackathon, setSelectedHackathon] = useState<any>(null)
  const [rankings, setRankings] = useState<any[]>([])
  const [winners, setWinners] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [declaringWinner, setDeclaringWinner] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    loadHackathons()
  }, [])

  const loadHackathons = async () => {
    try {
      setLoading(true)
      const { data } = await supabase
        .from('hackathons')
        .select('*')
        .order('created_at', { ascending: false })
      setHackathons(data || [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const loadRankings = async (hackathon: any) => {
    setSelectedHackathon(hackathon)
    setLoading(true)
    
    try {
      // Get teams
      const { data: teamsData } = await supabase
        .from('teams')
        .select('*')
        .eq('hackathon_id', hackathon.id)

      // Get evaluations
      const { data: evalsData } = await supabase
        .from('evaluations')
        .select('*')
        .eq('hackathon_id', hackathon.id)

      // Calculate rankings
      const joined = (teamsData || []).map(team => {
        const evals = (evalsData || []).filter((e: any) => e.team_id === team.id)
        const total = evals[0]?.total_score || 0
        return {
          ...team,
          total_score: total,
          evaluation: evals[0] || null,
          evaluations: evals
        }
      })

      const teamsWithScores = joined
        .filter(team => team.evaluations && team.evaluations.length > 0)
        .sort((a, b) => b.total_score - a.total_score)
      
      // Get existing winners
      const { data: existingWinners } = await supabase
        .from('winners')
        .select('*')
        .eq('hackathon_id', hackathon.id)
      
      setRankings(teamsWithScores)
      setWinners(existingWinners || [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const declareWinners = async () => {
    if (!confirm('Are you sure you want to declare winners for this hackathon?')) return
    
    setDeclaringWinner(true)
    
    try {
      // Get top 3 teams
      const top3 = rankings.slice(0, 3)
      const prizes = [5000, 3000, 1000] // 1st: $5000, 2nd: $3000, 3rd: $1000
      
      // Delete existing winners
      await supabase
        .from('winners')
        .delete()
        .eq('hackathon_id', selectedHackathon.id)

      // Delete existing certificates for this hackathon
      await supabase
        .from('certificates')
        .delete()
        .eq('hackathon_id', selectedHackathon.id)
      
      // Insert new winners & certificates
      const year = new Date().getFullYear()
      const genCertificateId = () =>
        `HH-${year}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`

      for (let i = 0; i < top3.length; i++) {
        const teamId = top3[i].id
        await supabase.from('winners').insert({
          hackathon_id: selectedHackathon.id,
          team_id: teamId,
          rank: i + 1,
          prize_amount: prizes[i],
          declared_at: new Date().toISOString()
        })

        // Get all members of the winning team
        const { data: members } = await supabase
          .from('team_members')
          .select('user_id')
          .eq('team_id', teamId)

        if (members && members.length > 0) {
          const certsToInsert = members.map(member => ({
            user_id: member.user_id,
            hackathon_id: selectedHackathon.id,
            certificate_type: 'winner',
            certificate_id: genCertificateId(),
            issued_at: new Date().toISOString()
          }))

          await supabase.from('certificates').insert(certsToInsert)
        }
      }
      
      alert('Winners declared and certificates generated successfully!')
      await loadRankings(selectedHackathon)
    } catch (e: any) {
      alert('Error: ' + e.message)
    } finally {
      setDeclaringWinner(false)
    }
  }

  if (loading) {
    return <div style={{ padding: '100px 20px', textAlign: 'center', fontSize: '18px', color: 'var(--text-secondary)' }}>Loading Leaderboard Data...</div>
  }

  return (
    <div className="premium-container fade-in" style={{ padding: '40px' }}>
      <div style={{ marginBottom: '40px' }}>
        <h1 style={{ fontSize: '32px', marginBottom: '8px', fontFamily: 'var(--font-display)' }}>🏆 Results & Standings</h1>
        <p style={{ color: 'var(--text-secondary)' }}>Audit evaluations, compute rankings, and declare official hackathon winners.</p>
      </div>

      {!selectedHackathon ? (
        <>
          <h2 style={{ fontSize: '20px', marginBottom: '20px', fontFamily: 'var(--font-display)' }}>Select Hackathon</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {hackathons.map((hackathon) => (
              <div key={hackathon.id} className="glass-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px' }}>
                <div>
                  <h3 style={{ fontSize: '18px', color: 'var(--text-primary)', marginBottom: '6px' }}>{hackathon.name}</h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>{hackathon.description || 'No description provided'}</p>
                </div>
                <button 
                  onClick={() => loadRankings(hackathon)}
                  className="btn btn-primary"
                  style={{ padding: '10px 24px' }}
                >
                  View Standings
                </button>
              </div>
            ))}
          </div>
        </>
      ) : (
        <>
          <button 
            onClick={() => setSelectedHackathon(null)}
            className="btn btn-secondary"
            style={{ marginBottom: '28px', padding: '8px 16px', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
          >
            <ArrowLeft size={16} /> Back to Hackathons
          </button>
          
          <h2 style={{ fontSize: '24px', marginBottom: '24px', fontFamily: 'var(--font-display)' }}>{selectedHackathon.name} - Standings</h2>
          
          {rankings.length === 0 ? (
            <div className="glass-card" style={{ textAlign: 'center', padding: '60px 40px', color: 'var(--text-secondary)' }}>
              No evaluations have been submitted for this hackathon yet.
            </div>
          ) : (
            <>
              {/* Winners Podium */}
              {winners.length > 0 && (
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'center', 
                  alignItems: 'flex-end', 
                  gap: '24px', 
                  margin: '40px 0',
                  padding: '40px 20px',
                  background: 'rgba(2, 132, 199, 0.04)',
                  borderRadius: '24px',
                  border: '1px solid var(--border-color)',
                  boxShadow: 'var(--glass-shadow)',
                  position: 'relative',
                  overflow: 'hidden'
                }}>
                  {/* Decorative Sparkle */}
                  <div style={{ position: 'absolute', top: '20px', right: '30px', color: 'var(--warning)', opacity: 0.7 }}>
                    <Sparkles size={24} />
                  </div>

                  {/* 2nd Place */}
                  {winners.find(w => w.rank === 2) && (
                    <div style={{ textAlign: 'center', width: '130px' }}>
                      <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {rankings.find(r => r.id === winners.find(w => w.rank === 2)?.team_id)?.team_name || 'Team'}
                      </div>
                      <div style={{ 
                        height: '140px', 
                        background: 'linear-gradient(180deg, #9ca3af 0%, #4b5563 100%)', 
                        borderRadius: '12px 12px 0 0', 
                        display: 'flex', 
                        flexDirection: 'column',
                        alignItems: 'center', 
                        justifyContent: 'center', 
                        paddingBottom: '10px',
                        boxShadow: '0 4px 15px rgba(0,0,0,0.3)',
                        border: '1px solid rgba(255,255,255,0.1)'
                      }}>
                        <span style={{ fontSize: '32px' }}>🥈</span>
                        <span style={{ fontSize: '13px', fontWeight: 700, color: '#000', background: '#fff', padding: '2px 8px', borderRadius: '10px', marginTop: '10px' }}>2nd</span>
                      </div>
                      <p style={{ marginTop: '12px', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '14px' }}>
                        ${winners.find(w => w.rank === 2)?.prize_amount}
                      </p>
                    </div>
                  )}
                  
                  {/* 1st Place */}
                  {winners.find(w => w.rank === 1) && (
                    <div style={{ textAlign: 'center', width: '150px' }}>
                      <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {rankings.find(r => r.id === winners.find(w => w.rank === 1)?.team_id)?.team_name || 'Team'}
                      </div>
                      <div style={{ 
                        height: '190px', 
                        background: 'linear-gradient(180deg, #fbbf24 0%, #d97706 100%)', 
                        borderRadius: '12px 12px 0 0', 
                        display: 'flex', 
                        flexDirection: 'column',
                        alignItems: 'center', 
                        justifyContent: 'center', 
                        paddingBottom: '10px',
                        boxShadow: '0 4px 25px rgba(251, 191, 36, 0.25)',
                        border: '1px solid rgba(255,255,255,0.2)'
                      }}>
                        <span style={{ fontSize: '42px' }}>🥇</span>
                        <span style={{ fontSize: '14px', fontWeight: 800, color: '#000', background: '#ffed4e', padding: '2px 10px', borderRadius: '10px', marginTop: '12px' }}>1st</span>
                      </div>
                      <p style={{ marginTop: '12px', fontWeight: 700, color: '#ca8a04', fontSize: '16px' }}>
                        ${winners.find(w => w.rank === 1)?.prize_amount}
                      </p>
                    </div>
                  )}
                  
                  {/* 3rd Place */}
                  {winners.find(w => w.rank === 3) && (
                    <div style={{ textAlign: 'center', width: '110px' }}>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {rankings.find(r => r.id === winners.find(w => w.rank === 3)?.team_id)?.team_name || 'Team'}
                      </div>
                      <div style={{ 
                        height: '100px', 
                        background: 'linear-gradient(180deg, #b45309 0%, #78350f 100%)', 
                        borderRadius: '12px 12px 0 0', 
                        display: 'flex', 
                        flexDirection: 'column',
                        alignItems: 'center', 
                        justifyContent: 'center', 
                        paddingBottom: '10px',
                        boxShadow: '0 4px 15px rgba(0,0,0,0.3)',
                        border: '1px solid rgba(255,255,255,0.05)'
                      }}>
                        <span style={{ fontSize: '28px' }}>🥉</span>
                        <span style={{ fontSize: '12px', fontWeight: 700, color: '#fff', background: 'rgba(255,255,255,0.15)', padding: '1px 6px', borderRadius: '10px', marginTop: '8px' }}>3rd</span>
                      </div>
                      <p style={{ marginTop: '12px', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '14px' }}>
                        ${winners.find(w => w.rank === 3)?.prize_amount}
                      </p>
                    </div>
                  )}
                </div>
              )}
              
              {/* Leaderboard Table */}
              <h3 style={{ fontSize: '20px', marginBottom: '20px', fontFamily: 'var(--font-display)' }}>Leaderboard Rankings</h3>
              <div className="table-container fade-in">
                <table className="premium-table">
                  <thead>
                    <tr>
                      <th style={{ width: '80px' }}>Rank</th>
                      <th>Team Name</th>
                      <th style={{ textAlign: 'center' }}>Total Score</th>
                      <th style={{ textAlign: 'center' }}>Position</th>
                      <th style={{ textAlign: 'center' }}>Prize Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rankings.map((team, index) => {
                      const winner = winners.find(w => w.team_id === team.id)
                      const isTop3 = index < 3
                      const rank = index + 1
                      const positionStr = rank === 1 ? '1st Place' : rank === 2 ? '2nd Place' : rank === 3 ? '3rd Place' : `${rank}th Place`

                      return (
                        <tr key={team.id}>
                          <td>
                            {index === 0 && '🥇'}
                            {index === 1 && '🥈'}
                            {index === 2 && '🥉'}
                            {index > 2 && `${index + 1}`}
                          </td>
                          <td style={{ fontWeight: isTop3 ? 700 : 500, color: 'var(--text-primary)' }}>
                            {team.team_name}
                          </td>
                          <td style={{ textAlign: 'center', fontWeight: 600, color: 'var(--primary)' }}>
                            {team.total_score?.toFixed(2) || 0} / 100.00
                          </td>
                          <td style={{ textAlign: 'center', fontWeight: 600, color: 'var(--text-primary)' }}>
                            {positionStr}
                          </td>
                          <td style={{ textAlign: 'center', fontWeight: 600, color: winner ? 'var(--warning)' : 'var(--text-muted)' }}>
                            {winner ? `$${winner.prize_amount}` : '-'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              
              <div style={{ marginTop: '40px', textAlign: 'center' }}>
                <button 
                  onClick={declareWinners}
                  disabled={declaringWinner || winners.length > 0}
                  className="btn btn-primary"
                  style={{ padding: '14px 32px', fontSize: '16px' }}
                >
                  {winners.length > 0 ? 'Winners Declared' : (declaringWinner ? 'Calculating Rankings...' : 'Declare Winners & Generate Certificates')}
                </button>
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
