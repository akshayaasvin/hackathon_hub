'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Users, BookOpen, Trophy, Send } from 'lucide-react'
import { withTimeout } from '@/lib/utils'

export default function CollegeDashboard() {
  const [collegeProfile, setCollegeProfile] = useState<any>(null)
  const [stats, setStats] = useState({ totalStudents: 0, teamsFormed: 0, submissionsMade: 0, topScore: 0 })
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

      const { data: profile } = await withTimeout(
        supabase.from('college_profiles').select('*').eq('user_id', user.id).maybeSingle(),
        5000
      )
      setCollegeProfile(profile)

      if (!profile) {
        setStats({ totalStudents: 0, teamsFormed: 0, submissionsMade: 0, topScore: 0 })
        return
      }

      const { data: participantProfiles } = await withTimeout(
        supabase.from('participant_profiles').select('user_id').eq('college_name', profile.college_name),
        5000
      )
      const userIds = (participantProfiles || []).map((p: any) => p.user_id)

      if (userIds.length === 0) {
        setStats({ totalStudents: 0, teamsFormed: 0, submissionsMade: 0, topScore: 0 })
        return
      }

      const { data: teamMembersData } = await withTimeout(
        supabase.from('team_members').select('team_id').in('user_id', userIds),
        5000
      )
      const teamIds = [...new Set((teamMembersData || []).map((tm: any) => tm.team_id))]

      const [submissionsRes, evaluationsRes] = teamIds.length
        ? await withTimeout(
            Promise.all([
              supabase.from('submissions').select('*').in('team_id', teamIds),
              supabase.from('evaluations').select('total_score').in('team_id', teamIds),
            ]),
            5000
          )
        : [{ data: [] as any[] }, { data: [] as any[] }]

      const submissionsMade = (submissionsRes.data || []).filter((s: any) => s.status === 'submitted').length
      const topScore = (evaluationsRes.data || []).reduce((max: number, e: any) => Math.max(max, e.total_score || 0), 0)

      setStats({
        totalStudents: userIds.length,
        teamsFormed: teamIds.length,
        submissionsMade,
        topScore,
      })
    } catch (err: any) {
      console.error('Error:', err)
      setError(err.message || 'Failed to load college dashboard.')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div style={{ padding: '100px 20px', textAlign: 'center', fontSize: '18px', color: 'var(--text-secondary)' }}>Loading College Dashboard...</div>
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
        <h1 style={{ fontSize: '32px', marginBottom: '8px', fontFamily: 'var(--font-display)' }}>College Portal</h1>
        <p style={{ color: 'var(--text-secondary)' }}>
          Institution: <span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{collegeProfile?.college_name}</span>.
          Track your students' hackathon journey — this view is read-only.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '24px' }}>
        <div className="glass-card stat-card-gradient" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ background: 'rgba(79, 70, 229, 0.1)', padding: '12px', borderRadius: '12px', color: 'var(--primary)' }}>
            <Users size={24} />
          </div>
          <div>
            <h3 style={{ fontSize: '28px', color: 'var(--text-primary)' }}>{stats.totalStudents}</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Total Students</p>
          </div>
        </div>
        <div className="glass-card stat-card-gradient" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ background: 'rgba(16, 185, 129, 0.1)', padding: '12px', borderRadius: '12px', color: 'var(--success)' }}>
            <BookOpen size={24} />
          </div>
          <div>
            <h3 style={{ fontSize: '28px', color: 'var(--text-primary)' }}>{stats.teamsFormed}</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Teams Formed</p>
          </div>
        </div>
        <div className="glass-card stat-card-gradient" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ background: 'rgba(245, 158, 11, 0.1)', padding: '12px', borderRadius: '12px', color: 'var(--warning)' }}>
            <Send size={24} />
          </div>
          <div>
            <h3 style={{ fontSize: '28px', color: 'var(--text-primary)' }}>{stats.submissionsMade}</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Submissions Made</p>
          </div>
        </div>
        <div className="glass-card stat-card-gradient" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ background: 'rgba(6, 182, 212, 0.1)', padding: '12px', borderRadius: '12px', color: 'var(--secondary)' }}>
            <Trophy size={24} />
          </div>
          <div>
            <h3 style={{ fontSize: '28px', color: 'var(--text-primary)' }}>{stats.topScore.toFixed(1)}</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Top Score</p>
          </div>
        </div>
      </div>
    </div>
  )
}
