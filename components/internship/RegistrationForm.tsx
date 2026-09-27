'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { Loader2, Upload } from 'lucide-react'
import { postJson } from '@/lib/apiFetch'
import { normalizeIndianMobile } from '@/lib/phone'
import { validateRegistrationAnswers, type FixedFieldKey, type FormConfig, type Question as ConfigQuestion } from '@/lib/internshipForm'

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
const errorTextStyle = { color: 'var(--danger)', fontSize: '13px', marginTop: '6px', lineHeight: 1.5 } as const
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
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
 *
 * Every error is shown inline under its own field (never only a top banner) and the page
 * scrolls to and focuses the first invalid field on submit — critical on mobile, where the
 * submit button is usually the last thing in view and a banner at the top of the form is
 * never seen. The top banner is reserved for genuinely field-less errors: network failure,
 * a 500, or "registration closed".
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
  const [phone, setPhone] = useState(normalizeIndianMobile(prefill.phone) || prefill.phone.replace(/\D/g, '').slice(0, 10))
  const [values, setValues] = useState<Record<string, AnswerValue>>({})
  const [resumeFile, setResumeFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  // Non-field errors only (network failure, server 500, registration closed) — everything
  // else renders inline under its own field via `fieldErrors`.
  const [formError, setFormError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  const fieldRefs = useRef<Record<string, HTMLElement | null>>({})
  const setFieldRef = (id: string) => (el: HTMLElement | null) => {
    fieldRefs.current[id] = el
  }
  const clearFieldError = (id: string) => {
    setFieldErrors((prev) => {
      if (!(id in prev)) return prev
      const next = { ...prev }
      delete next[id]
      return next
    })
  }

  const setValue = (id: string, v: AnswerValue) => {
    setValues((prev) => ({ ...prev, [id]: v }))
    clearFieldError(id)
  }
  const toggleCheckbox = (id: string, option: string) => {
    const current = Array.isArray(values[id]) ? (values[id] as string[]) : []
    setValue(id, current.includes(option) ? current.filter((o) => o !== option) : [...current, option])
  }

  const resumeMeta = fixedFields.find((f) => f.key === 'resume')
  const otherFixed = fixedFields.filter((f) => f.key !== 'resume')
  // DOM/tab order, top to bottom — used to find the FIRST invalid field, matching form order
  // rather than object-key order (which JS doesn't guarantee matches insertion for this case).
  const fieldOrder = ['fullName', 'email', 'phone', ...otherFixed.map((f) => f.key), ...questions.map((q) => q.id), 'resume']
  const knownFieldIds = new Set(fieldOrder)

  const scrollToFirstError = (errors: Record<string, string>) => {
    const firstId = fieldOrder.find((id) => errors[id])
    if (!firstId) return
    const el = fieldRefs.current[firstId]
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    el.focus?.({ preventScroll: true })
  }

  const validateClientSide = (): Record<string, string> => {
    const errors: Record<string, string> = {}
    if (fullName.trim().length < 2) errors.fullName = 'Enter your full name (at least 2 characters).'
    if (!EMAIL_RE.test(email.trim())) errors.email = 'Enter a valid email address.'
    if (!normalizeIndianMobile(phone)) errors.phone = 'Enter a valid 10-digit mobile number.'

    // Same validator the server runs (lib/internshipForm.ts) — guarantees the client can never
    // disagree with the server about what "valid" means for an admin-configured field.
    const formConfig: FormConfig = {
      fixedFields: fixedFields.map((f) => ({ key: f.key as FixedFieldKey, required: f.required })),
      questions: questions as ConfigQuestion[],
    }
    const result = validateRegistrationAnswers(formConfig, values)
    if (result.ok === false) Object.assign(errors, result.fieldErrors)

    if (resumeMeta?.required && !resumeFile) errors.resume = 'Please attach your resume.'
    else if (resumeFile && resumeFile.size > MAX_RESUME_BYTES) errors.resume = `Resume must be under ${Math.floor(MAX_RESUME_BYTES / (1024 * 1024))}MB.`

    return errors
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)

    const errors = validateClientSide()
    setFieldErrors(errors)
    if (Object.keys(errors).length > 0) {
      scrollToFirstError(errors)
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
        const matched = Object.fromEntries(Object.entries(res.fieldErrors ?? {}).filter(([k]) => knownFieldIds.has(k)))
        if (Object.keys(matched).length > 0) {
          setFieldErrors((prev) => ({ ...prev, ...matched }))
          scrollToFirstError(matched)
        } else {
          setFormError(res.message)
        }
        setBusy(false)
        return
      }
      onSubmitted(res.data)
    } catch (err) {
      console.error('[internship register] failed:', err)
      setFormError('Something went wrong. Please try again.')
      setBusy(false)
    }
  }

  const renderField = (id: string, label: string, type: FixedFieldMeta['type'], required: boolean, options: string[] | undefined) => {
    const domId = `if-${id}`
    const errorId = `${domId}-error`
    const err = fieldErrors[id]
    const value = values[id]
    const asText = typeof value === 'string' ? value : ''
    const star = required ? <span style={{ color: 'var(--danger)' }}> *</span> : null
    const invalidStyle = err ? { borderColor: 'var(--danger)' } : undefined
    const commonProps = {
      id: domId,
      'aria-invalid': !!err || undefined,
      'aria-describedby': err ? errorId : undefined,
    } as const

    switch (type) {
      case 'paragraph':
        return (
          <div key={id} style={{ marginBottom: '16px' }}>
            <label htmlFor={domId} style={labelStyle}>{label}{star}</label>
            <textarea
              {...commonProps}
              ref={setFieldRef(id) as any}
              className="premium-input"
              style={invalidStyle}
              rows={3}
              maxLength={2000}
              value={asText}
              onChange={(e) => setValue(id, e.target.value)}
            />
            {err && <p id={errorId} role="alert" style={errorTextStyle}>{err}</p>}
          </div>
        )
      case 'radio':
        return (
          <fieldset key={id} ref={setFieldRef(id) as any} tabIndex={-1} style={{ border: 'none', padding: 0, margin: '0 0 16px' }}>
            <legend style={labelStyle}>{label}{star}</legend>
            <div style={{ display: 'grid', gap: '8px' }}>
              {options?.map((o) => (
                <label key={o} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', cursor: 'pointer' }}>
                  <input type="radio" name={domId} value={o} checked={value === o} onChange={() => setValue(id, o)} /> {o}
                </label>
              ))}
            </div>
            {err && <p id={errorId} role="alert" style={errorTextStyle}>{err}</p>}
          </fieldset>
        )
      case 'checkbox':
        return (
          <fieldset key={id} ref={setFieldRef(id) as any} tabIndex={-1} style={{ border: 'none', padding: 0, margin: '0 0 16px' }}>
            <legend style={labelStyle}>{label}{star}</legend>
            <div style={{ display: 'grid', gap: '8px' }}>
              {options?.map((o) => (
                <label key={o} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={Array.isArray(value) && value.includes(o)} onChange={() => toggleCheckbox(id, o)} /> {o}
                </label>
              ))}
            </div>
            {err && <p id={errorId} role="alert" style={errorTextStyle}>{err}</p>}
          </fieldset>
        )
      case 'dropdown':
        return (
          <div key={id} style={{ marginBottom: '16px' }}>
            <label htmlFor={domId} style={labelStyle}>{label}{star}</label>
            <select {...commonProps} ref={setFieldRef(id) as any} className="premium-input" style={invalidStyle} value={asText} onChange={(e) => setValue(id, e.target.value)}>
              <option value="">Select…</option>
              {options?.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
            {err && <p id={errorId} role="alert" style={errorTextStyle}>{err}</p>}
          </div>
        )
      case 'year':
        return (
          <div key={id} style={{ marginBottom: '16px' }}>
            <label htmlFor={domId} style={labelStyle}>{label}{star}</label>
            <input {...commonProps} ref={setFieldRef(id) as any} type="number" min="1950" max="2100" className="premium-input" style={invalidStyle} value={asText} onChange={(e) => setValue(id, e.target.value)} />
            {err && <p id={errorId} role="alert" style={errorTextStyle}>{err}</p>}
          </div>
        )
      case 'date':
        return (
          <div key={id} style={{ marginBottom: '16px' }}>
            <label htmlFor={domId} style={labelStyle}>{label}{star}</label>
            <input {...commonProps} ref={setFieldRef(id) as any} type="date" className="premium-input" style={invalidStyle} value={asText} onChange={(e) => setValue(id, e.target.value)} />
            {err && <p id={errorId} role="alert" style={errorTextStyle}>{err}</p>}
          </div>
        )
      case 'number':
        return (
          <div key={id} style={{ marginBottom: '16px' }}>
            <label htmlFor={domId} style={labelStyle}>{label}{star}</label>
            <input {...commonProps} ref={setFieldRef(id) as any} type="number" step="any" className="premium-input" style={invalidStyle} value={asText} onChange={(e) => setValue(id, e.target.value)} />
            {err && <p id={errorId} role="alert" style={errorTextStyle}>{err}</p>}
          </div>
        )
      case 'url':
        return (
          <div key={id} style={{ marginBottom: '16px' }}>
            <label htmlFor={domId} style={labelStyle}>{label}{star}</label>
            <input {...commonProps} ref={setFieldRef(id) as any} type="url" className="premium-input" style={invalidStyle} placeholder="https://" value={asText} onChange={(e) => setValue(id, e.target.value)} />
            {err && <p id={errorId} role="alert" style={errorTextStyle}>{err}</p>}
          </div>
        )
      default:
        return (
          <div key={id} style={{ marginBottom: '16px' }}>
            <label htmlFor={domId} style={labelStyle}>{label}{star}</label>
            <input {...commonProps} ref={setFieldRef(id) as any} type="text" className="premium-input" style={invalidStyle} maxLength={300} value={asText} onChange={(e) => setValue(id, e.target.value)} />
            {err && <p id={errorId} role="alert" style={errorTextStyle}>{err}</p>}
          </div>
        )
    }
  }

  return (
    // Bottom padding keeps the last field and the submit button clear of the floating
    // WhatsApp button (fixed bottom-right, ~56px + margin — see WhatsAppButton.tsx), which
    // otherwise sits on top of them on mobile.
    <div className="glass-card" style={{ padding: '28px 24px', paddingBottom: '96px' }}>
      <h3 style={{ fontSize: '18px', marginBottom: '16px' }}>Registration Details</h3>

      {formError && (
        <div role="alert" style={{ background: 'var(--danger-bg)', border: '1px solid var(--danger-border)', color: 'var(--danger)', padding: '12px', borderRadius: '8px', marginBottom: '16px', fontSize: '14px' }}>
          {formError}
        </div>
      )}

      {/* noValidate: every check is our own (below), shown inline in the app's own style —
          the browser's native "Please include an '@'…" tooltip would otherwise still pop up
          and look inconsistent with everything else here. */}
      <form onSubmit={handleSubmit} noValidate>
        <div style={{ marginBottom: '16px' }}>
          <label htmlFor="rf-name" style={labelStyle}>Full name <span style={{ color: 'var(--danger)' }}>*</span></label>
          <input
            id="rf-name"
            ref={setFieldRef('fullName') as any}
            className="premium-input"
            style={fieldErrors.fullName ? { borderColor: 'var(--danger)' } : undefined}
            value={fullName}
            onChange={(e) => { setFullName(e.target.value); clearFieldError('fullName') }}
            maxLength={100}
            autoComplete="name"
            aria-invalid={!!fieldErrors.fullName || undefined}
            aria-describedby={fieldErrors.fullName ? 'rf-name-error' : undefined}
          />
          {fieldErrors.fullName && <p id="rf-name-error" role="alert" style={errorTextStyle}>{fieldErrors.fullName}</p>}
        </div>
        <div style={{ marginBottom: '16px' }}>
          <label htmlFor="rf-email" style={labelStyle}>Email <span style={{ color: 'var(--danger)' }}>*</span></label>
          <input
            id="rf-email"
            ref={setFieldRef('email') as any}
            type="email"
            className="premium-input"
            style={fieldErrors.email ? { borderColor: 'var(--danger)' } : undefined}
            value={email}
            onChange={(e) => { setEmail(e.target.value); clearFieldError('email') }}
            maxLength={254}
            autoComplete="email"
            disabled={!!carry}
            aria-invalid={!!fieldErrors.email || undefined}
            aria-describedby={fieldErrors.email ? 'rf-email-error' : undefined}
          />
          {fieldErrors.email && (
            <p id="rf-email-error" role="alert" style={errorTextStyle}>
              {fieldErrors.email}
              {fieldErrors.email.toLowerCase().includes('already registered') && (
                <>
                  {' '}
                  <Link href="/internship/status" style={{ color: 'var(--primary)', fontWeight: 600 }}>
                    Check your application status
                  </Link>
                  .
                </>
              )}
            </p>
          )}
        </div>
        <div style={{ marginBottom: '16px' }}>
          <label htmlFor="rf-phone" style={labelStyle}>Mobile number <span style={{ color: 'var(--danger)' }}>*</span></label>
          <input
            id="rf-phone"
            ref={setFieldRef('phone') as any}
            type="tel"
            inputMode="numeric"
            className="premium-input"
            style={fieldErrors.phone ? { borderColor: 'var(--danger)' } : undefined}
            value={phone}
            onChange={(e) => { setPhone(e.target.value.replace(/\D/g, '').slice(0, 10)); clearFieldError('phone') }}
            maxLength={10}
            autoComplete="tel"
            aria-invalid={!!fieldErrors.phone || undefined}
            aria-describedby={fieldErrors.phone ? 'rf-phone-error' : undefined}
          />
          {fieldErrors.phone && <p id="rf-phone-error" role="alert" style={errorTextStyle}>{fieldErrors.phone}</p>}
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
              ref={setFieldRef('resume') as any}
              tabIndex={0}
              className="premium-input"
              style={{
                display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer',
                color: resumeFile ? 'var(--text-primary)' : 'var(--text-muted)',
                ...(fieldErrors.resume ? { borderColor: 'var(--danger)' } : {}),
              }}
              aria-invalid={!!fieldErrors.resume || undefined}
              aria-describedby={fieldErrors.resume ? 'rf-resume-error' : undefined}
            >
              <Upload size={16} />
              {resumeFile ? resumeFile.name : 'Choose PDF or Word document (max 3MB)'}
            </label>
            <input
              id="rf-resume"
              type="file"
              accept=".pdf,.doc,.docx"
              style={{ display: 'none' }}
              onChange={(e) => { setResumeFile(e.target.files?.[0] ?? null); clearFieldError('resume') }}
            />
            {fieldErrors.resume && <p id="rf-resume-error" role="alert" style={errorTextStyle}>{fieldErrors.resume}</p>}
          </div>
        )}

        <button type="submit" disabled={busy} className="btn btn-primary" style={{ width: '100%', padding: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
          {busy && <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />}
          {busy ? 'Please wait…' : 'Continue'}
        </button>
        {busy && <style>{'@keyframes spin { to { transform: rotate(360deg) } }'}</style>}
      </form>
    </div>
  )
}
