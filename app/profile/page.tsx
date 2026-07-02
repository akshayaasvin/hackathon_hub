'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { User, Mail, Phone, School, GraduationCap, MapPin, Lock, Save } from 'lucide-react'

export default function ProfilePage() {
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState({
    full_name: '',
    email: '',
    college_name: '',
    passout_year: '',
    degree: '',
    domain: '',
    experience_level: 'fresher',
    contact_number: '',
    address: ''
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

      const [{ data: userData }, { data: participantData }] = await Promise.all([
        supabase.from('users').select('*').eq('id', user.id).single(),
        supabase.from('participant_profiles').select('*').eq('user_id', user.id).maybeSingle()
      ])

      setProfile({
        full_name: userData?.full_name || '',
        email: user.email || '',
        college_name: participantData?.college_name || '',
        passout_year: participantData?.passout_year?.toString() || '',
        degree: participantData?.degree || '',
        domain: participantData?.domain || '',
        experience_level: participantData?.experience_level || 'fresher',
        contact_number: participantData?.contact_number || '',
        address: participantData?.address || ''
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
      const { error: userError } = await supabase
        .from('users')
        .update({ full_name: profile.full_name, updated_at: new Date().toISOString() })
        .eq('id', user.id)

      if (userError) throw userError

      const { error: profileError } = await supabase
        .from('participant_profiles')
        .update({
          college_name: profile.college_name,
          passout_year: Number(profile.passout_year),
          degree: profile.degree,
          domain: profile.domain,
          experience_level: profile.experience_level,
          contact_number: profile.contact_number,
          address: profile.address,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', user.id)

      if (profileError) throw profileError

      setMessage('Profile updated successfully!')
      setTimeout(() => setMessage(''), 3000)

    } catch (error: any) {
      setMessage('Error: ' + error.message)
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
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) throw error
      alert('Password changed successfully!')
    } catch (error: any) {
      alert('Error: ' + error.message)
    }
  }

  if (loading) {
    return <div style={{ padding: '100px 20px', textAlign: 'center', fontSize: '18px', color: 'var(--text-secondary)' }}>Loading Profile Details...</div>
  }

  return (
    <div className="premium-container fade-in" style={{ maxWidth: '800px' }}>
      <div style={{ marginBottom: '40px' }}>
        <h1 style={{ fontSize: '32px', marginBottom: '8px', fontFamily: 'var(--font-display)' }}>My Profile</h1>
        <p style={{ color: 'var(--text-secondary)' }}>Manage your personal details, academic information and password.</p>
      </div>

      {message && (
        <div className="glass-card" style={{
          padding: '16px 20px',
          background: message.startsWith('Error') ? 'var(--danger-bg)' : 'var(--success-bg)',
          borderLeft: message.startsWith('Error') ? '4px solid var(--danger)' : '4px solid var(--success)',
          color: message.startsWith('Error') ? 'var(--danger)' : 'var(--success)',
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
            <Phone size={14} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'text-bottom' }} /> Contact Number
          </label>
          <input
            type="tel"
            name="contact_number"
            value={profile.contact_number}
            onChange={handleChange}
            placeholder="+1 555-019-2834"
            className="premium-input"
          />
        </div>

        <h2 style={{ fontSize: '18px', color: 'var(--text-primary)', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', marginBottom: '24px' }}>
          Academic Information
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
            placeholder="e.g. PSNA College of Engineering"
            className="premium-input"
          />
        </div>

        <div className="responsive-grid-2" style={{ marginBottom: '20px' }}>
          <div>
            <label style={{ display: 'block', fontWeight: 600, fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
              <GraduationCap size={14} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'text-bottom' }} /> Degree
            </label>
            <input
              type="text"
              name="degree"
              value={profile.degree}
              onChange={handleChange}
              placeholder="e.g. B.Tech"
              className="premium-input"
            />
          </div>

          <div>
            <label style={{ display: 'block', fontWeight: 600, fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
              Domain / Branch
            </label>
            <input
              type="text"
              name="domain"
              value={profile.domain}
              onChange={handleChange}
              placeholder="e.g. Computer Science"
              className="premium-input"
            />
          </div>
        </div>

        <div className="responsive-grid-2" style={{ marginBottom: '32px' }}>
          <div>
            <label style={{ display: 'block', fontWeight: 600, fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
              Passout Year
            </label>
            <input
              type="number"
              name="passout_year"
              value={profile.passout_year}
              onChange={handleChange}
              placeholder="2026"
              className="premium-input"
            />
          </div>

          <div>
            <label style={{ display: 'block', fontWeight: 600, fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
              Experience Level
            </label>
            <select
              name="experience_level"
              value={profile.experience_level}
              onChange={handleChange}
              className="premium-input premium-select"
            >
              <option value="fresher">Fresher</option>
              <option value="experienced">Experienced</option>
            </select>
          </div>
        </div>

        <div style={{ marginBottom: '32px' }}>
          <label style={{ display: 'block', fontWeight: 600, fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
            <MapPin size={14} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'text-bottom' }} /> Address
          </label>
          <input
            type="text"
            name="address"
            value={profile.address}
            onChange={handleChange}
            placeholder="City, State"
            className="premium-input"
          />
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
