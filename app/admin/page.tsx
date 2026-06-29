'use client'

import { useState, useEffect } from 'react'
import { createClient } from '../../lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Plus, Check, Play, Edit3, Calendar, Users, DollarSign, Layers, CheckSquare, FileSpreadsheet, Send, School, Gavel, Trophy, Megaphone } from 'lucide-react'
import { withTimeout } from '../../lib/utils'

export default function AdminDashboard() {
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [dataLoading, setDataLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Dashboard Stats
  const [stats, setStats] = useState({
    totalHackathons: 0,
    activeHackathons: 0,
    pendingRegistrations: 0,
    totalTeams: 0
  })
  
  const [hackathons, setHackathons] = useState<any[]>([])
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    theme: '',
    start_date: '',
    end_date: '',
    registration_deadline: '',
    registration_fee: 0,
    max_team_size: 5
  })
  
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    loadDashboardData()
  }, [])

  const loadDashboardData = async () => {
    try {
      setDataLoading(true)
      setError(null)
      
      const { data: { user } } = await withTimeout(supabase.auth.getUser(), 5000)
      if (!user) {
        router.push('/login')
        return
      }
      
      const { data: userData } = await withTimeout(
        supabase
          .from('users')
          .select('role')
          .eq('id', user.id)
          .single(),
        5000
      )
      
      if (userData?.role !== 'admin') {
        router.push('/participant')
        return
      }

      // Fetch hackathons, registrations and teams in parallel with 5s timeout
      const [hackathonsRes, pendingRes, teamsRes] = await withTimeout(
        Promise.all([
          supabase.from('hackathons').select('*').order('created_at', { ascending: false }),
          supabase.from('registrations').select('*', { count: 'exact', head: true }).eq('registration_status', 'pending'),
          supabase.from('teams').select('*', { count: 'exact', head: true })
        ]),
        5000
      )

      const hackathonList = hackathonsRes.data || []
      setHackathons(hackathonList)

      const pendingCount = pendingRes.count || 0
      const teamCount = teamsRes.count || 0
      const total = hackathonList.length
      const active = hackathonList.filter((h: any) => h.status === 'published' || h.status === 'ongoing').length

      setStats({
        totalHackathons: total,
        activeHackathons: active,
        pendingRegistrations: pendingCount,
        totalTeams: teamCount
      })
      
    } catch (e: any) {
      console.error(e)
      setError(e.message || 'Failed to load dashboard data. Connection timed out.')
    } finally {
      setDataLoading(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    const startDate = formData.start_date ? new Date(formData.start_date).toISOString() : null
    const endDate = formData.end_date ? new Date(formData.end_date).toISOString() : null
    const regDeadline = formData.registration_deadline ? new Date(formData.registration_deadline).toISOString() : null

    const { error } = await supabase.from('hackathons').insert({
      name: formData.name,
      description: formData.description,
      theme: formData.theme,
      start_date: startDate,
      end_date: endDate,
      registration_deadline: regDeadline,
      registration_fee: Number(formData.registration_fee),
      max_team_size: Number(formData.max_team_size),
      status: 'draft'
    })

    if (error) {
      alert('Error: ' + error.message)
    } else {
      alert('Hackathon created successfully!')
      setShowForm(false)
      setFormData({
        name: '',
        description: '',
        theme: '',
        start_date: '',
        end_date: '',
        registration_deadline: '',
        registration_fee: 0,
        max_team_size: 5
      })
      loadDashboardData()
    }
    setLoading(false)
  }

  const updateHackathonStatus = async (id: string, newStatus: string) => {
    const { error } = await supabase
      .from('hackathons')
      .update({ status: newStatus })
      .eq('id', id)

    if (error) {
      alert('Error updating status: ' + error.message)
    } else {
      alert(`Hackathon status updated to ${newStatus}!`)
      loadDashboardData()
    }
  }

  if (dataLoading) {
    return <div style={{ padding: '100px 20px', textAlign: 'center', fontSize: '18px', color: 'var(--text-secondary)' }}>Loading Admin Portal...</div>
  }

  if (error) {
    return (
      <div className="premium-container fade-in" style={{ maxWidth: '600px', marginTop: '60px' }}>
        <div className="glass-card" style={{ borderLeft: '4px solid var(--danger)', padding: '32px', textAlign: 'center' }}>
          <h2 style={{ color: 'var(--danger)', fontSize: '20px', marginBottom: '12px' }}>⚠️ Loading Failure</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '24px' }}>{error}</p>
          <button onClick={loadDashboardData} className="btn btn-primary" style={{ padding: '10px 24px' }}>
            Retry Loading
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="premium-container fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px', flexWrap: 'wrap', gap: '20px' }}>
        <div>
          <h1 style={{ fontSize: '32px', marginBottom: '8px', fontFamily: 'var(--font-display)' }}>Admin Dashboard</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Monitor metrics, manage registrations and configure hackathon parameters.</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="btn btn-primary"
        >
          {showForm ? 'Cancel Creation' : <><Plus size={18} /> Create Hackathon</>}
        </button>
      </div>

      {/* Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '24px', marginBottom: '40px' }}>
        <div className="glass-card stat-card-gradient" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ background: 'rgba(79, 70, 229, 0.1)', padding: '12px', borderRadius: '12px', color: 'var(--primary)' }}>
            <Layers size={24} />
          </div>
          <div>
            <h3 style={{ fontSize: '28px', color: 'var(--text-primary)' }}>{stats.totalHackathons}</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Total Hackathons</p>
          </div>
        </div>
        <div className="glass-card stat-card-gradient" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ background: 'rgba(16, 185, 129, 0.1)', padding: '12px', borderRadius: '12px', color: 'var(--success)' }}>
            <Play size={24} />
          </div>
          <div>
            <h3 style={{ fontSize: '28px', color: 'var(--text-primary)' }}>{stats.activeHackathons}</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Active Hackathons</p>
          </div>
        </div>
        <div className="glass-card stat-card-gradient" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ background: 'rgba(245, 158, 11, 0.1)', padding: '12px', borderRadius: '12px', color: 'var(--warning)' }}>
            <Calendar size={24} />
          </div>
          <div>
            <h3 style={{ fontSize: '28px', color: 'var(--text-primary)' }}>{stats.pendingRegistrations}</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Pending Approvals</p>
          </div>
        </div>
        <div className="glass-card stat-card-gradient" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ background: 'rgba(6, 182, 212, 0.1)', padding: '12px', borderRadius: '12px', color: 'var(--secondary)' }}>
            <Users size={24} />
          </div>
          <div>
            <h3 style={{ fontSize: '28px', color: 'var(--text-primary)' }}>{stats.totalTeams}</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Registered Teams</p>
          </div>
        </div>
      </div>

      {/* Quick Action Cards */}
      <h2 style={{ fontSize: '20px', marginBottom: '20px', fontFamily: 'var(--font-display)' }}>Quick Actions</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px', marginBottom: '40px' }}>
        <button onClick={() => setShowForm(!showForm)} className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: '16px', textAlign: 'left', cursor: 'pointer', border: '1px solid rgba(2, 132, 199, 0.15)', background: 'rgba(2, 132, 199, 0.02)', padding: '20px', width: '100%', fontFamily: 'inherit' }}>
          <div style={{ background: 'rgba(2, 132, 199, 0.1)', padding: '10px', borderRadius: '10px', color: 'var(--primary)' }}>
            <Plus size={20} />
          </div>
          <div>
            <h4 style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '15px', margin: 0 }}>Create Hackathon</h4>
            <p style={{ color: 'var(--text-secondary)', fontSize: '12px', marginTop: '2px', margin: 0 }}>Configure a new event</p>
          </div>
        </button>

        <button onClick={() => router.push('/admin/approvals')} className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: '16px', textAlign: 'left', cursor: 'pointer', border: '1px solid rgba(245, 158, 11, 0.15)', background: 'rgba(245, 158, 11, 0.02)', padding: '20px', width: '100%', fontFamily: 'inherit' }}>
          <div style={{ background: 'rgba(245, 158, 11, 0.1)', padding: '10px', borderRadius: '10px', color: 'var(--warning)' }}>
            <CheckSquare size={20} />
          </div>
          <div>
            <h4 style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '15px', margin: 0 }}>View Approvals</h4>
            <p style={{ color: 'var(--text-secondary)', fontSize: '12px', marginTop: '2px', margin: 0 }}>Review pending students</p>
          </div>
        </button>

        <button onClick={() => router.push('/admin/applications')} className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: '16px', textAlign: 'left', cursor: 'pointer', border: '1px solid rgba(16, 185, 129, 0.15)', background: 'rgba(16, 185, 129, 0.02)', padding: '20px', width: '100%', fontFamily: 'inherit' }}>
          <div style={{ background: 'rgba(16, 185, 129, 0.1)', padding: '10px', borderRadius: '10px', color: 'var(--success)' }}>
            <FileSpreadsheet size={20} />
          </div>
          <div>
            <h4 style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '15px', margin: 0 }}>View Applications</h4>
            <p style={{ color: 'var(--text-secondary)', fontSize: '12px', marginTop: '2px', margin: 0 }}>List all student sign-ups</p>
          </div>
        </button>

        <button onClick={() => router.push('/admin/submissions')} className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: '16px', textAlign: 'left', cursor: 'pointer', border: '1px solid rgba(168, 85, 247, 0.15)', background: 'rgba(168, 85, 247, 0.02)', padding: '20px', width: '100%', fontFamily: 'inherit' }}>
          <div style={{ background: 'rgba(168, 85, 247, 0.1)', padding: '10px', borderRadius: '10px', color: 'var(--secondary)' }}>
            <Send size={20} />
          </div>
          <div>
            <h4 style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '15px', margin: 0 }}>View Submissions</h4>
            <p style={{ color: 'var(--text-secondary)', fontSize: '12px', marginTop: '2px', margin: 0 }}>Inspect team presentations</p>
          </div>
        </button>

        <button onClick={() => router.push('/admin/colleges')} className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: '16px', textAlign: 'left', cursor: 'pointer', border: '1px solid rgba(6, 182, 212, 0.15)', background: 'rgba(6, 182, 212, 0.02)', padding: '20px', width: '100%', fontFamily: 'inherit' }}>
          <div style={{ background: 'rgba(6, 182, 212, 0.1)', padding: '10px', borderRadius: '10px', color: '#0891b2' }}>
            <School size={20} />
          </div>
          <div>
            <h4 style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '15px', margin: 0 }}>Manage Colleges</h4>
            <p style={{ color: 'var(--text-secondary)', fontSize: '12px', marginTop: '2px', margin: 0 }}>Directory of institutions</p>
          </div>
        </button>

        <button onClick={() => router.push('/admin/jury')} className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: '16px', textAlign: 'left', cursor: 'pointer', border: '1px solid rgba(236, 72, 153, 0.15)', background: 'rgba(236, 72, 153, 0.02)', padding: '20px', width: '100%', fontFamily: 'inherit' }}>
          <div style={{ background: 'rgba(236, 72, 153, 0.1)', padding: '10px', borderRadius: '10px', color: '#db2777' }}>
            <Gavel size={20} />
          </div>
          <div>
            <h4 style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '15px', margin: 0 }}>Manage Jury</h4>
            <p style={{ color: 'var(--text-secondary)', fontSize: '12px', marginTop: '2px', margin: 0 }}>Configure panel judges</p>
          </div>
        </button>

        <button onClick={() => router.push('/admin/results')} className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: '16px', textAlign: 'left', cursor: 'pointer', border: '1px solid rgba(234, 179, 8, 0.15)', background: 'rgba(234, 179, 8, 0.02)', padding: '20px', width: '100%', fontFamily: 'inherit' }}>
          <div style={{ background: 'rgba(234, 179, 8, 0.1)', padding: '10px', borderRadius: '10px', color: '#ca8a04' }}>
            <Trophy size={20} />
          </div>
          <div>
            <h4 style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '15px', margin: 0 }}>View Results</h4>
            <p style={{ color: 'var(--text-secondary)', fontSize: '12px', marginTop: '2px', margin: 0 }}>Leaderboards & Winners</p>
          </div>
        </button>

        <button onClick={() => router.push('/admin/announcements')} className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: '16px', textAlign: 'left', cursor: 'pointer', border: '1px solid rgba(249, 115, 22, 0.15)', background: 'rgba(249, 115, 22, 0.02)', padding: '20px', width: '100%', fontFamily: 'inherit' }}>
          <div style={{ background: 'rgba(249, 115, 22, 0.1)', padding: '10px', borderRadius: '10px', color: '#ea580c' }}>
            <Megaphone size={20} />
          </div>
          <div>
            <h4 style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '15px', margin: 0 }}>Manage Announcements</h4>
            <p style={{ color: 'var(--text-secondary)', fontSize: '12px', marginTop: '2px', margin: 0 }}>Publish global updates</p>
          </div>
        </button>
      </div>

      {showForm && (
        <div className="glass-card fade-in" style={{ marginBottom: '40px', borderLeft: '4px solid var(--primary)' }}>
          <h2 style={{ marginBottom: '24px', fontSize: '22px' }}>Configure New Hackathon</h2>
          <form onSubmit={handleSubmit}>
            <div className="responsive-grid-2" style={{ marginBottom: '20px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, fontSize: '14px', color: 'var(--text-secondary)' }}>Hackathon Name *</label>
                <input 
                  name="name" 
                  value={formData.name} 
                  onChange={handleChange} 
                  required 
                  className="premium-input"
                  placeholder="e.g. AI Innovation Summit"
                />
              </div>
              
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, fontSize: '14px', color: 'var(--text-secondary)' }}>Theme</label>
                <input 
                  name="theme" 
                  value={formData.theme} 
                  onChange={handleChange} 
                  className="premium-input"
                  placeholder="e.g. Generative AI / Web3"
                />
              </div>
            </div>
            
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, fontSize: '14px', color: 'var(--text-secondary)' }}>Description</label>
              <textarea 
                name="description" 
                value={formData.description} 
                onChange={handleChange} 
                rows={3} 
                className="premium-input"
                placeholder="Describe guidelines, tracks, and objectives..."
              />
            </div>
            
            <div className="responsive-grid-3" style={{ marginBottom: '20px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, fontSize: '14px', color: 'var(--text-secondary)' }}>Start Date & Time *</label>
                <input 
                  type="datetime-local" 
                  name="start_date" 
                  value={formData.start_date} 
                  onChange={handleChange} 
                  required 
                  className="premium-input" 
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, fontSize: '14px', color: 'var(--text-secondary)' }}>End Date & Time *</label>
                <input 
                  type="datetime-local" 
                  name="end_date" 
                  value={formData.end_date} 
                  onChange={handleChange} 
                  required 
                  className="premium-input" 
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, fontSize: '14px', color: 'var(--text-secondary)' }}>Registration Deadline *</label>
                <input 
                  type="datetime-local" 
                  name="registration_deadline" 
                  value={formData.registration_deadline} 
                  onChange={handleChange} 
                  required 
                  className="premium-input" 
                />
              </div>
            </div>
            
            <div className="responsive-grid-2" style={{ marginBottom: '28px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, fontSize: '14px', color: 'var(--text-secondary)' }}>Registration Fee ($)</label>
                <input 
                  type="number" 
                  name="registration_fee" 
                  value={formData.registration_fee} 
                  onChange={handleChange} 
                  className="premium-input" 
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, fontSize: '14px', color: 'var(--text-secondary)' }}>Max Team Size</label>
                <input 
                  type="number" 
                  name="max_team_size" 
                  value={formData.max_team_size} 
                  onChange={handleChange} 
                  className="premium-input" 
                />
              </div>
            </div>
            
            <div style={{ display: 'flex', gap: '12px' }}>
              <button 
                type="submit" 
                disabled={loading} 
                className="btn btn-primary"
              >
                {loading ? 'Publishing...' : 'Deploy Hackathon'}
              </button>
              <button 
                type="button" 
                onClick={() => setShowForm(false)} 
                className="btn btn-secondary"
              >
                Discard
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Hackathons Table List */}
      <h2 style={{ fontSize: '20px', marginBottom: '20px', fontFamily: 'var(--font-display)' }}>Manage Hackathons</h2>
      <div className="table-container fade-in">
        <table className="premium-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Theme</th>
              <th>Deadline</th>
              <th>Fee</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {hackathons.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>No hackathons configured yet.</td>
              </tr>
            ) : (
              hackathons.map((h) => {
                const isDraft = h.status === 'draft'
                const isPublished = h.status === 'published'
                const isOngoing = h.status === 'ongoing'
                const isCompleted = h.status === 'completed'
                
                return (
                  <tr key={h.id}>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{h.name}</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px', maxWidth: '400px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {h.description || 'No description'}
                      </div>
                    </td>
                    <td>{h.theme || '-'}</td>
                    <td>{new Date(h.registration_deadline).toLocaleDateString()}</td>
                    <td>{h.registration_fee > 0 ? `$${h.registration_fee}` : 'Free'}</td>
                    <td>
                      <span style={{
                        padding: '4px 10px',
                        borderRadius: '20px',
                        fontSize: '12px',
                        fontWeight: 600,
                        background: isDraft ? 'rgba(107, 114, 128, 0.15)' : isPublished ? 'rgba(99, 102, 241, 0.15)' : isOngoing ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                        color: isDraft ? 'var(--text-secondary)' : isPublished ? 'var(--primary)' : isOngoing ? 'var(--success)' : 'var(--danger)'
                      }}>
                        {h.status.toUpperCase()}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        {isDraft && (
                          <button
                            onClick={() => updateHackathonStatus(h.id, 'published')}
                            className="btn btn-secondary"
                            style={{ padding: '6px 12px', fontSize: '13px', color: 'var(--success)', borderColor: 'rgba(16, 185, 129, 0.3)' }}
                          >
                            Publish
                          </button>
                        )}
                        {isPublished && (
                          <button
                            onClick={() => updateHackathonStatus(h.id, 'ongoing')}
                            className="btn btn-secondary"
                            style={{ padding: '6px 12px', fontSize: '13px', color: 'var(--primary)', borderColor: 'rgba(99, 102, 241, 0.3)' }}
                          >
                            Start
                          </button>
                        )}
                        {isOngoing && (
                          <button
                            onClick={() => updateHackathonStatus(h.id, 'completed')}
                            className="btn btn-secondary"
                            style={{ padding: '6px 12px', fontSize: '13px', color: 'var(--danger)', borderColor: 'rgba(239, 68, 68, 0.3)' }}
                          >
                            End
                          </button>
                        )}
                        <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
                          {isCompleted && 'Archived'}
                        </span>
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}