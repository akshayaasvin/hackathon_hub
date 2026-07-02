'use client'

import { useState } from 'react'
import { FormField } from './FormField'
import { juryRegisterSchema } from '@/lib/validation'

const gridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  columnGap: '16px',
}

export function JuryRegisterForm({ onSuccess }: { onSuccess: (status: string) => void }) {
  const [form, setForm] = useState({
    full_name: '',
    contact_number: '',
    email: '',
    official_email: '',
    organization_name: '',
    portfolio_url: '',
    occupation: '',
    experience_years: '',
    date_of_birth: '',
    location: '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [serverError, setServerError] = useState('')
  const [loading, setLoading] = useState(false)

  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setServerError('')

    const parsed = juryRegisterSchema.safeParse({ role: 'jury', ...form })
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
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed.data),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Registration failed')
      onSuccess(json.status)
    } catch (err: any) {
      setServerError(err.message)
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
        <FormField label="Contact Number" error={errors.contact_number}>
          <input className="premium-input" value={form.contact_number} onChange={set('contact_number')} required />
        </FormField>
        <FormField label="Email ID" error={errors.email}>
          <input type="email" className="premium-input" value={form.email} onChange={set('email')} required />
        </FormField>
        <FormField label="Official Email ID" error={errors.official_email}>
          <input
            type="email"
            className="premium-input"
            value={form.official_email}
            onChange={set('official_email')}
          />
        </FormField>
        <FormField label="Company / College / Portfolio Website" error={errors.portfolio_url}>
          <input
            className="premium-input"
            placeholder="https://..."
            value={form.portfolio_url}
            onChange={set('portfolio_url')}
          />
        </FormField>
        <FormField label="Organization Name" error={errors.organization_name}>
          <input
            className="premium-input"
            value={form.organization_name}
            onChange={set('organization_name')}
          />
        </FormField>
        <FormField label="Occupation" error={errors.occupation}>
          <input className="premium-input" value={form.occupation} onChange={set('occupation')} required />
        </FormField>
        <FormField label="Years of Experience" error={errors.experience_years}>
          <input
            type="number"
            className="premium-input"
            value={form.experience_years}
            onChange={set('experience_years')}
          />
        </FormField>
        <FormField label="Date of Birth" error={errors.date_of_birth}>
          <input type="date" className="premium-input" value={form.date_of_birth} onChange={set('date_of_birth')} />
        </FormField>
        <FormField label="Location / Address" error={errors.location}>
          <input className="premium-input" value={form.location} onChange={set('location')} required />
        </FormField>
      </div>

      <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
        No password needed here — once an admin approves your registration, login credentials will be
        emailed to you.
      </p>

      <button
        type="submit"
        disabled={loading}
        className="btn btn-primary"
        style={{ width: '100%', padding: '14px' }}
      >
        {loading ? 'Submitting...' : 'Submit for Admin Review'}
      </button>
    </form>
  )
}
