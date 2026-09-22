'use client'

import { useState } from 'react'
import { Upload } from 'lucide-react'
import { postJson } from '@/lib/apiFetch'

interface FixedFieldMeta {
  key: string
  label: string
  type: 'text' | 'paragraph' | 'radio' | 'checkbox' | 'dropdown' | 'date' | 'year' | 'number' | 'url' | 'resume'
  required: boolean
  options?: string[]
}
interface Question {
  id: string
  label: string
  type: 'text' | 'paragraph' | 'radio' | 'checkbox' | 'dropdown' | 'date' | 'year' | 'number' | 'url'
  required: boolean
  options?: string[]
}

type AnswerValue = string | string[]

interface RegisterResult {
  registrationId: string
  registrationCode: string
  accessToken: string
  paymentRequired: boolean
  order?: { order_id: string; amount: number; currency: string; key_id: string }
}

const labelStyle = { display: 'block', marginBottom: '6px', fontWeight: 600, fontSize: '14px', color: 'var(--text-secondary)' } as const
const MAX_RESUME_BYTES = 3 * 1024 * 1024

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('Could not read the selected file.'))
    reader.readAsDataURL(file)
  })
}

/**
 * Renders the internship's configured registration form (fixed fields the admin enabled +
 * custom questions) and submits it. Works both fresh (no prior assessment) and resumed
 * (carrying registrationId/accessToken from a passed AssessmentRunner) — see section 6/7.
 */
export default function RegistrationForm({
  internshipId,
  fixedFields,
  questions,
  prefill,
  carry,
  onSubmitted,
}: {
  internshipId: string
  fixedFields: FixedFieldMeta[]
  questions: Question[]
  prefill: { fullName: string; email: string; phone: string }
  carry: { registrationId: string; accessToken: string } | null
  onSubmitted: (result: RegisterResult) => void
}) {
  const [fullName, setFullName] = useState(prefill.fullName)
  const [email, setEmail] = useState(prefill.email)
  const [phone, setPhone] = useState(prefill.phone)
  const [values, setValues] = useState<Record<string, AnswerValue>>({})
  const [resumeFile, setResumeFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const setValue = (id: string, v: AnswerValue) => setValues((prev) => ({ ...prev, [id]: v }))
  const toggleCheckbox = (id: string, option: string) => {
    const current = Array.isArray(values[id]) ? (values[id] as string[]) : []
    setValue(id, current.includes(option) ? current.filter((o) => o !== option) : [...current, option])
  }

  const resumeMeta = fixedFields.find((f) => f.key === 'resume')
  const otherFixed = fixedFields.filter((f) => f.key !== 'resume')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const requiredCheckboxes = [
      ...otherFixed.map((f) => ({ id: f.key, label: f.label, type: f.type, required: f.required })),
      ...questions.map((q) => ({ id: q.id, label: q.label, type: q.type, required: q.required })),
    ]
    for (const q of requiredCheckboxes) {
      if (q.type === 'checkbox' && q.required && !(Array.isArray(values[q.id]) && (values[q.id] as string[]).length > 0)) {
        setError(`Please answer "${q.label}".`)
        return
      }
    }
    if (resumeMeta?.required && !resumeFile) {
      setError('Please attach your resume.')
      return
    }
    if (resumeFile && resumeFile.size > MAX_RESUME_BYTES) {
      setError(`Resume must be under ${Math.floor(MAX_RESUME_BYTES / (1024 * 1024))}MB.`)
      return
    }

    setBusy(true)
    try {
      let resumeDataUrl: string | undefined
      if (resumeFile) resumeDataUrl = await fileToDataUrl(resumeFile)

      const res = await postJson<RegisterResult>(`/api/internship/${internshipId}/register`, {
        ...(carry ? { registrationId: carry.registrationId, accessToken: carry.accessToken } : {}),
        fullName,
        email,
        phone,
        fields: values,
        ...(resumeDataUrl ? { resumeDataUrl } : {}),
      })
      if (!res.success || !res.data) {
        setError(res.message)
        setBusy(false)
        return
      }
      onSubmitted(res.data)
    } catch (err) {
      console.error('[internship register] failed:', err)
      setError('Something went wrong. Please try again.')
      setBusy(false)
    }
  }

  const renderField = (id: string, label: string, type: FixedFieldMeta['type'], required: boolean, options: string[] | undefined) => {
    const domId = `if-${id}`
    const value = values[id]
    const asText = typeof value === 'string' ? value : ''
    const star = required ? <span style={{ color: 'var(--danger)' }}> *</span> : null

    switch (type) {
      case 'paragraph':
        return (
          <div key={id} style={{ marginBottom: '16px' }}>
            <label htmlFor={domId} style={labelStyle}>{label}{star}</label>
            <textarea id={domId} className="premium-input" rows={3} maxLength={2000} required={required} value={asText} onChange={(e) => setValue(id, e.target.value)} />
          </div>
        )
      case 'radio':
        return (
          <fieldset key={id} style={{ border: 'none', padding: 0, margin: '0 0 16px' }}>
            <legend style={labelStyle}>{label}{star}</legend>
            <div style={{ display: 'grid', gap: '8px' }}>
              {options?.map((o) => (
                <label key={o} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', cursor: 'pointer' }}>
                  <input type="radio" name={domId} value={o} checked={value === o} onChange={() => setValue(id, o)} /> {o}
                </label>
              ))}
            </div>
          </fieldset>
        )
      case 'checkbox':
        return (
          <fieldset key={id} style={{ border: 'none', padding: 0, margin: '0 0 16px' }}>
            <legend style={labelStyle}>{label}{star}</legend>
            <div style={{ display: 'grid', gap: '8px' }}>
              {options?.map((o) => (
                <label key={o} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={Array.isArray(value) && value.includes(o)} onChange={() => toggleCheckbox(id, o)} /> {o}
                </label>
              ))}
            </div>
          </fieldset>
        )
      case 'dropdown':
        return (
          <div key={id} style={{ marginBottom: '16px' }}>
            <label htmlFor={domId} style={labelStyle}>{label}{star}</label>
            <select id={domId} className="premium-input" required={required} value={asText} onChange={(e) => setValue(id, e.target.value)}>
              <option value="">Select…</option>
              {options?.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
        )
      case 'year':
        return (
          <div key={id} style={{ marginBottom: '16px' }}>
            <label htmlFor={domId} style={labelStyle}>{label}{star}</label>
            <input id={domId} type="number" min="1950" max="2100" className="premium-input" required={required} value={asText} onChange={(e) => setValue(id, e.target.value)} />
          </div>
        )
      case 'date':
        return (
          <div key={id} style={{ marginBottom: '16px' }}>
            <label htmlFor={domId} style={labelStyle}>{label}{star}</label>
            <input id={domId} type="date" className="premium-input" required={required} value={asText} onChange={(e) => setValue(id, e.target.value)} />
          </div>
        )
      case 'number':
        return (
          <div key={id} style={{ marginBottom: '16px' }}>
            <label htmlFor={domId} style={labelStyle}>{label}{star}</label>
            <input id={domId} type="number" step="any" className="premium-input" required={required} value={asText} onChange={(e) => setValue(id, e.target.value)} />
          </div>
        )
      case 'url':
        return (
          <div key={id} style={{ marginBottom: '16px' }}>
            <label htmlFor={domId} style={labelStyle}>{label}{star}</label>
            <input id={domId} type="url" className="premium-input" placeholder="https://" required={required} value={asText} onChange={(e) => setValue(id, e.target.value)} />
          </div>
        )
      default:
        return (
          <div key={id} style={{ marginBottom: '16px' }}>
            <label htmlFor={domId} style={labelStyle}>{label}{star}</label>
            <input id={domId} type="text" className="premium-input" maxLength={300} required={required} value={asText} onChange={(e) => setValue(id, e.target.value)} />
          </div>
        )
    }
  }

  return (
    <div className="glass-card" style={{ padding: '28px 24px' }}>
      <h3 style={{ fontSize: '18px', marginBottom: '16px' }}>Registration Details</h3>

      {error && (
        <div role="alert" style={{ background: 'var(--danger-bg)', border: '1px solid var(--danger-border)', color: 'var(--danger)', padding: '12px', borderRadius: '8px', marginBottom: '16px', fontSize: '14px' }}>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '16px' }}>
          <label htmlFor="rf-name" style={labelStyle}>Full name <span style={{ color: 'var(--danger)' }}>*</span></label>
          <input id="rf-name" className="premium-input" value={fullName} onChange={(e) => setFullName(e.target.value)} required minLength={2} maxLength={100} autoComplete="name" />
        </div>
        <div style={{ marginBottom: '16px' }}>
          <label htmlFor="rf-email" style={labelStyle}>Email <span style={{ color: 'var(--danger)' }}>*</span></label>
          <input id="rf-email" type="email" className="premium-input" value={email} onChange={(e) => setEmail(e.target.value)} required maxLength={254} autoComplete="email" disabled={!!carry} />
        </div>
        <div style={{ marginBottom: '16px' }}>
          <label htmlFor="rf-phone" style={labelStyle}>Mobile number <span style={{ color: 'var(--danger)' }}>*</span></label>
          <input id="rf-phone" type="tel" inputMode="numeric" className="premium-input" value={phone} onChange={(e) => setPhone(e.target.value)} required maxLength={20} autoComplete="tel" />
        </div>

        {otherFixed.map((f) => renderField(f.key, f.label, f.type, f.required, f.options))}
        {questions.map((q) => renderField(q.id, q.label, q.type, q.required, q.options))}

        {resumeMeta && (
          <div style={{ marginBottom: '20px' }}>
            <label htmlFor="rf-resume" style={labelStyle}>
              Resume {resumeMeta.required && <span style={{ color: 'var(--danger)' }}>*</span>}
            </label>
            <label
              htmlFor="rf-resume"
              className="premium-input"
              style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', color: resumeFile ? 'var(--text-primary)' : 'var(--text-muted)' }}
            >
              <Upload size={16} />
              {resumeFile ? resumeFile.name : 'Choose PDF or Word document (max 3MB)'}
            </label>
            <input
              id="rf-resume"
              type="file"
              accept=".pdf,.doc,.docx"
              style={{ display: 'none' }}
              onChange={(e) => setResumeFile(e.target.files?.[0] ?? null)}
              required={resumeMeta.required}
            />
          </div>
        )}

        <button type="submit" disabled={busy} className="btn btn-primary" style={{ width: '100%', padding: '14px' }}>
          {busy ? 'Please wait…' : 'Continue'}
        </button>
      </form>
    </div>
  )
}
