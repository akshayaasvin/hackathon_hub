'use client'

import { useEffect, useState } from 'react'
import { FormField } from './FormField'
import { participantRegisterSchema } from '@/lib/validation'
import { postJson } from '@/lib/apiFetch'
import { createClient } from '@/lib/supabase/client'

const gridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  columnGap: '16px',
}

function todayISODate(): string {
  return new Date().toISOString().slice(0, 10)
}

export function ParticipantRegisterForm({ onSuccess }: { onSuccess: (status: string) => void }) {
  const [form, setForm] = useState({
    full_name: '',
    email: '',
    password: '',
    college_name: '',
    passout_year: '',
    degree: '',
    domain: '',
    experience_level: 'fresher',
    contact_number: '',
    address: '',
    date_of_birth: '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [serverError, setServerError] = useState('')
  const [loading, setLoading] = useState(false)
  const [colleges, setColleges] = useState<{ id: string; name: string }[]>([])
  const [collegeId, setCollegeId] = useState<string | null>(null)
  const [collegeQuery, setCollegeQuery] = useState('')
  const [showCollegeOptions, setShowCollegeOptions] = useState(false)

  useEffect(() => {
    let cancelled = false
    createClient()
      .from('colleges')
      .select('id, name')
      .order('name', { ascending: true })
      .then(({ data }) => {
        if (!cancelled) setColleges(data || [])
      })
    return () => {
      cancelled = true
    }
  }, [])

  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }))

  const collegeMatches =
    collegeQuery.trim().length > 0
      ? colleges.filter((c) => c.name.toLowerCase().includes(collegeQuery.trim().toLowerCase())).slice(0, 8)
      : colleges.slice(0, 8)

  const handleCollegeQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setCollegeQuery(value)
    setCollegeId(null)
    setForm((f) => ({ ...f, college_name: value }))
    setShowCollegeOptions(true)
  }

  const handleCollegeSelect = (college: { id: string; name: string }) => {
    setCollegeQuery(college.name)
    setCollegeId(college.id)
    setForm((f) => ({ ...f, college_name: college.name }))
    setShowCollegeOptions(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setServerError('')

    const parsed = participantRegisterSchema.safeParse({
      role: 'participant',
      ...form,
      college_id: collegeId || undefined,
    })
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {}
      for (const issue of parsed.error.issues) {
        fieldErrors[String(issue.path[0])] = issue.message
      }
      setErrors(fieldErrors)
      return
    }
    setErrors({})
    setLoading(true)
    try {
      const result = await postJson<{ status: string }>('/api/auth/register', parsed.data)
      if (!result.success) {
        setServerError(result.message)
        return
      }
      onSuccess(result.data!.status)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      {serverError && (
        <div
          style={{
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.2)',
            color: 'var(--danger)',
            padding: '12px',
            borderRadius: '8px',
            marginBottom: '20px',
            fontSize: '14px',
            textAlign: 'center',
          }}
        >
          {serverError}
        </div>
      )}

      <div style={gridStyle}>
        <FormField label="Full Name" error={errors.full_name}>
          <input className="premium-input" value={form.full_name} onChange={set('full_name')} required />
        </FormField>
        <FormField label="Email Address" error={errors.email}>
          <input type="email" className="premium-input" value={form.email} onChange={set('email')} required />
        </FormField>
      </div>

      <FormField label="Password" error={errors.password}>
        <input
          type="password"
          className="premium-input"
          value={form.password}
          onChange={set('password')}
          required
        />
      </FormField>

      <div style={gridStyle}>
        <FormField label="College Name" error={errors.college_name}>
          <div style={{ position: 'relative' }}>
            <input
              className="premium-input"
              placeholder="Search for your college..."
              value={collegeQuery}
              onChange={handleCollegeQueryChange}
              onFocus={() => setShowCollegeOptions(true)}
              onBlur={() => setTimeout(() => setShowCollegeOptions(false), 150)}
              autoComplete="off"
              required
            />
            {showCollegeOptions && collegeMatches.length > 0 && (
              <div
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 4px)',
                  left: 0,
                  right: 0,
                  zIndex: 20,
                  maxHeight: '220px',
                  overflowY: 'auto',
                  background: 'var(--surface, #fff)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '10px',
                  boxShadow: 'var(--glass-shadow)',
                }}
              >
                {collegeMatches.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onMouseDown={() => handleCollegeSelect(c)}
                    style={{
                      display: 'block',
                      width: '100%',
                      textAlign: 'left',
                      padding: '10px 14px',
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: '14px',
                      color: 'var(--text-primary)',
                    }}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            )}
          </div>
          {collegeQuery.trim().length > 0 && !collegeId && (
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '6px' }}>
              My college isn't listed — this will be saved and flagged for admin to link later.
            </p>
          )}
        </FormField>
        <FormField label="Passout Year" error={errors.passout_year}>
          <input
            type="number"
            className="premium-input"
            value={form.passout_year}
            onChange={set('passout_year')}
            required
          />
        </FormField>
        <FormField label="Degree" error={errors.degree}>
          <input className="premium-input" value={form.degree} onChange={set('degree')} required />
        </FormField>
        <FormField label="Domain / Branch" error={errors.domain}>
          <input className="premium-input" value={form.domain} onChange={set('domain')} required />
        </FormField>
        <FormField label="Experience Level" error={errors.experience_level}>
          <select
            className="premium-input premium-select"
            value={form.experience_level}
            onChange={set('experience_level')}
          >
            <option value="fresher">Fresher</option>
            <option value="experienced">Experienced</option>
          </select>
        </FormField>
        <FormField label="Contact Number" error={errors.contact_number}>
          <input className="premium-input" value={form.contact_number} onChange={set('contact_number')} required />
        </FormField>
        <FormField label="Date of Birth" error={errors.date_of_birth}>
          <input
            type="date"
            className="premium-input"
            value={form.date_of_birth}
            onChange={set('date_of_birth')}
            max={todayISODate()}
            required
          />
        </FormField>
      </div>

      <FormField label="Address" error={errors.address}>
        <input className="premium-input" value={form.address} onChange={set('address')} required />
      </FormField>

      <button
        type="submit"
        disabled={loading}
        className="btn btn-primary"
        style={{ width: '100%', padding: '14px', marginTop: '8px' }}
      >
        {loading ? 'Creating account...' : 'Register as Student'}
      </button>
    </form>
  )
}
