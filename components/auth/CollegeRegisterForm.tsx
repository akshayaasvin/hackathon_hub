'use client'

import { useState } from 'react'
import { FormField } from './FormField'
import { collegeRegisterSchema } from '@/lib/validation'
import { postJson } from '@/lib/apiFetch'

const gridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  columnGap: '16px',
}

export function CollegeRegisterForm({ onSuccess }: { onSuccess: (status: string) => void }) {
  const [form, setForm] = useState({
    college_name: '',
    representative_name: '',
    position_in_college: '',
    date_of_birth: '',
    official_email: '',
    personal_email: '',
    contact_number: '',
    department: '',
    college_address: '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [serverError, setServerError] = useState('')
  const [loading, setLoading] = useState(false)

  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setServerError('')

    const parsed = collegeRegisterSchema.safeParse({ role: 'college', ...form })
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
        <FormField label="College Name" error={errors.college_name}>
          <input className="premium-input" value={form.college_name} onChange={set('college_name')} required />
        </FormField>
        <FormField label="Representative's Name" error={errors.representative_name}>
          <input
            className="premium-input"
            value={form.representative_name}
            onChange={set('representative_name')}
            required
          />
        </FormField>
        <FormField label="Position in College" error={errors.position_in_college}>
          <input
            className="premium-input"
            placeholder="e.g. HOD, Placement Officer, Dean"
            value={form.position_in_college}
            onChange={set('position_in_college')}
            required
          />
        </FormField>
        <FormField label="Date of Birth" error={errors.date_of_birth}>
          <input type="date" className="premium-input" value={form.date_of_birth} onChange={set('date_of_birth')} />
        </FormField>
        <FormField label="Official (Work) Email" error={errors.official_email}>
          <input
            type="email"
            className="premium-input"
            value={form.official_email}
            onChange={set('official_email')}
            required
          />
        </FormField>
        <FormField label="Personal Email" error={errors.personal_email}>
          <input
            type="email"
            className="premium-input"
            value={form.personal_email}
            onChange={set('personal_email')}
          />
        </FormField>
        <FormField label="Contact Number" error={errors.contact_number}>
          <input className="premium-input" value={form.contact_number} onChange={set('contact_number')} required />
        </FormField>
        <FormField label="Department" error={errors.department}>
          <input className="premium-input" value={form.department} onChange={set('department')} />
        </FormField>
      </div>

      <FormField label="College Address" error={errors.college_address}>
        <input
          className="premium-input"
          value={form.college_address}
          onChange={set('college_address')}
          required
        />
      </FormField>

      <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
        No password needed here — once an admin approves your registration, login credentials will be
        emailed to your official address.
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
