'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../lib/supabase/client'
import { User, Mail, Phone, School, GraduationCap, Calendar, Lock, Save } from 'lucide-react'

export default function ProfilePage() {
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState({
    full_name: '',
    email: '',
    phone: '',
    college_name: '',
    department: '',
    year_of_study: ''
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    loadProfile()
  }, [])

  const loadProfile = async () => {
    try {
      setLoading(true)
      
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }
      setUser(user)

      // Get profile from users table
      const { data: userData } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single()

      setProfile({
        full_name: userData?.full_name || user.user_metadata?.full_name || '',
        email: user.email || '',
        phone: userData?.phone || '',
        college_name: userData?.college_name || '',
        department: userData?.department || '',
        year_of_study: userData?.year_of_study || ''
      })
      
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setProfile({ ...profile, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setMessage('')

    try {
      const { error } = await supabase
        .from('users')
        .update({
          full_name: profile.full_name,
          phone: profile.phone,
          college_name: profile.college_name,
          department: profile.department,
          year_of_study: profile.year_of_study,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id)

      if (error) throw error

      setMessage('✅ Profile updated successfully!')
      setTimeout(() => setMessage(''), 3000)
      
    } catch (error: any) {
      setMessage('❌ Error: ' + error.message)
    } finally {
      setSaving(false)
    }
  }

  const handleChangePassword = async () => {
    const newPassword = prompt('Enter new password:')
    if (!newPassword) return
    
    if (newPassword.length < 6) {
      alert('Password must be at least 6 characters')
      return
    }

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      })
      
      if (error) throw error
      alert('✅ Password changed successfully!')
      
    } catch (error: any) {
      alert('❌ Error: ' + error.message)
    }
  }

  if (loading) {
    return <div style={{ padding: '100px 20px', textAlign: 'center', fontSize: '18px', color: 'var(--text-secondary)' }}>Loading Profile Details...</div>
  }

  return (
    <div className="premium-container fade-in" style={{ maxWidth: '800px' }}>
      <div style={{ marginBottom: '40px' }}>
        <h1 style={{ fontSize: '32px', marginBottom: '8px', fontFamily: 'var(--font-display)' }}>👤 My Profile</h1>
        <p style={{ color: 'var(--text-secondary)' }}>Manage your personal details, academic metadata and access passwords.</p>
      </div>

      {message && (
        <div className="glass-card" style={{
          padding: '16px 20px',
          background: message.includes('✅') ? 'var(--success-bg)' : 'var(--danger-bg)',
          borderLeft: message.includes('✅') ? '4px solid var(--success)' : '4px solid var(--danger)',
          color: message.includes('✅') ? 'var(--success)' : 'var(--danger)',
          borderRadius: '12px',
          marginBottom: '28px',
          fontSize: '15px'
        }}>
          {message}
        </div>
      )}

      <form onSubmit={handleSubmit} className="glass-card">
        <h2 style={{ fontSize: '18px', color: 'var(--text-primary)', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', marginBottom: '24px' }}>
          Personal Information
        </h2>
        
        <div className="responsive-grid-2" style={{ marginBottom: '20px' }}>
          <div>
            <label style={{ display: 'block', fontWeight: 600, fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
              <User size={14} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'text-bottom' }} /> Full Name
            </label>
            <input
              type="text"
              name="full_name"
              value={profile.full_name}
              onChange={handleChange}
              placeholder="e.g. Alex Morgan"
              className="premium-input"
            />
          </div>

          <div>
            <label style={{ display: 'block', fontWeight: 600, fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
              <Mail size={14} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'text-bottom' }} /> Email Address
            </label>
            <input
              type="email"
              value={profile.email}
              disabled
              className="premium-input"
              style={{ background: 'rgba(0,0,0,0.04)', color: 'var(--text-secondary)', cursor: 'not-allowed' }}
            />
          </div>
        </div>

        <div style={{ marginBottom: '32px' }}>
          <label style={{ display: 'block', fontWeight: 600, fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
            <Phone size={14} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'text-bottom' }} /> Phone Number
          </label>
          <input
            type="tel"
            name="phone"
            value={profile.phone}
            onChange={handleChange}
            placeholder="+1 555-019-2834"
            className="premium-input"
          />
        </div>

        <h2 style={{ fontSize: '18px', color: 'var(--text-primary)', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', marginBottom: '24px' }}>
          Academic Coordinates
        </h2>

        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', fontWeight: 600, fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
            <School size={14} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'text-bottom' }} /> College / Institution Name
          </label>
          <input
            type="text"
            name="college_name"
            value={profile.college_name}
            onChange={handleChange}
            placeholder="Massachusetts Institute of Technology"
            className="premium-input"
          />
        </div>

        <div className="responsive-grid-2" style={{ marginBottom: '32px' }}>
          <div>
            <label style={{ display: 'block', fontWeight: 600, fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
              <GraduationCap size={14} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'text-bottom' }} /> Major / Department
            </label>
            <input
              type="text"
              name="department"
              value={profile.department}
              onChange={handleChange}
              placeholder="Computer Science"
              className="premium-input"
            />
          </div>

          <div>
            <label style={{ display: 'block', fontWeight: 600, fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
              <Calendar size={14} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'text-bottom' }} /> Year of Study
            </label>
            <select
              name="year_of_study"
              value={profile.year_of_study}
              onChange={handleChange}
              className="premium-input premium-select"
            >
              <option value="">Select Year</option>
              <option value="1st Year">1st Year</option>
              <option value="2nd Year">2nd Year</option>
              <option value="3rd Year">3rd Year</option>
              <option value="4th Year">4th Year</option>
              <option value="Graduate">Graduate</option>
              <option value="Post Graduate">Post Graduate</option>
            </select>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
          <button
            type="submit"
            disabled={saving}
            className="btn btn-primary"
            style={{ padding: '12px 28px' }}
          >
            <Save size={16} /> {saving ? 'Saving...' : 'Save Profile Changes'}
          </button>
          
          <button
            type="button"
            onClick={handleChangePassword}
            className="btn btn-secondary"
            style={{ padding: '12px 24px' }}
          >
            <Lock size={16} /> Reset Password
          </button>
        </div>
      </form>
    </div>
  )
}