'use client'

import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, Clock, XCircle } from 'lucide-react'
import { postJson } from '@/lib/apiFetch'

interface PublicQuestion {
  id: string
  label: string
  type: 'radio' | 'checkbox' | 'dropdown' | 'yesno' | 'short' | 'paragraph'
  required: boolean
  options?: string[]
}

type AnswerValue = string | string[]

const labelStyle = { display: 'block', marginBottom: '6px', fontWeight: 600, fontSize: '14px', color: 'var(--text-secondary)' } as const

/**
 * Runs the eligibility assessment (section 4/5): collects identity, starts the attempt,
 * renders the questions, enforces a client-side countdown mirroring the server-enforced
 * time limit, and submits for server-side scoring. Calls onPassed(registrationId,
 * accessToken) once the applicant is eligible — the caller moves on to registration.
 */
export default function AssessmentRunner({
  internshipId,
  prefill,
  onPassed,
}: {
  internshipId: string
  prefill: { fullName: string; email: string; phone: string }
  onPassed: (registrationId: string, accessToken: string) => void
}) {
  const [stage, setStage] = useState<'identity' | 'questions' | 'result'>('identity')
  const [fullName, setFullName] = useState(prefill.fullName)
  const [email, setEmail] = useState(prefill.email)
  const [phone, setPhone] = useState(prefill.phone)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [registrationId, setRegistrationId] = useState<string | null>(null)
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [questions, setQuestions] = useState<PublicQuestion[]>([])
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>({})
  const [deadline, setDeadline] = useState<number | null>(null)
  const [remainingSec, setRemainingSec] = useState<number | null>(null)

  const [result, setResult] = useState<{ passed: boolean; score: number; total: number; passingScorePercent: number } | null>(null)

  useEffect(() => {
    if (deadline === null) return
    const tick = () => setRemainingSec(Math.max(0, Math.round((deadline - Date.now()) / 1000)))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [deadline])

  const timeUp = remainingSec === 0

  const startAssessment = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const res = await postJson<{ registrationId: string; accessToken: string; startedAt: string; timeLimitMinutes: number | null; questions: PublicQuestion[] }>(
      `/api/internship/${internshipId}/assessment/start`,
      { fullName, email, phone }
    )
    setBusy(false)
    if (!res.success || !res.data) {
      setError(res.message)
      return
    }
    setRegistrationId(res.data.registrationId)
    setAccessToken(res.data.accessToken)
    setQuestions(res.data.questions)
    setAnswers({})
    if (res.data.timeLimitMinutes) {
      setDeadline(new Date(res.data.startedAt).getTime() + res.data.timeLimitMinutes * 60_000)
    }
    setStage('questions')
  }

  const setAnswer = (id: string, value: AnswerValue) => setAnswers((prev) => ({ ...prev, [id]: value }))
  const toggleCheckbox = (id: string, option: string) => {
    const current = Array.isArray(answers[id]) ? (answers[id] as string[]) : []
    setAnswer(id, current.includes(option) ? current.filter((o) => o !== option) : [...current, option])
  }

  const submitAssessment = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!registrationId || !accessToken) return
    for (const q of questions) {
      if (q.type === 'checkbox' && q.required && !(Array.isArray(answers[q.id]) && (answers[q.id] as string[]).length > 0)) {
        setError(`Please answer "${q.label}".`)
        return
      }
    }
    setBusy(true)
    setError(null)
    const res = await postJson<{ passed: boolean; score: number; total: number; passingScorePercent: number }>(
      `/api/internship/${internshipId}/assessment/submit`,
      { registrationId, accessToken, answers }
    )
    setBusy(false)
    if (!res.success || !res.data) {
      setError(res.message)
      return
    }
    setResult(res.data)
    setStage('result')
    if (res.data.passed) onPassed(registrationId, accessToken)
  }

  // Auto-submit whatever was answered once the clock runs out.
  useEffect(() => {
    if (timeUp && stage === 'questions') void submitAssessment()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeUp])

  const mm = remainingSec != null ? String(Math.floor(remainingSec / 60)).padStart(2, '0') : null
  const ss = remainingSec != null ? String(remainingSec % 60).padStart(2, '0') : null

  if (stage === 'result' && result) {
    return (
      <div className="glass-card" style={{ padding: '32px 24px', borderLeft: `4px solid ${result.passed ? 'var(--success)' : 'var(--danger)'}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px', color: result.passed ? 'var(--success)' : 'var(--danger)' }}>
          {result.passed ? <CheckCircle2 size={26} /> : <XCircle size={26} />}
          <h3 style={{ fontSize: '20px', margin: 0 }}>{result.passed ? "You're eligible!" : 'Not eligible this time'}</h3>
        </div>
        {result.total > 0 && (
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '12px' }}>
            Score: {result.score}/{result.total} (passing score: {result.passingScorePercent}%)
          </p>
        )}
        {result.passed ? (
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Continuing to the registration form…</p>
        ) : (
          <div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '16px' }}>
              You did not meet the eligibility criteria for this internship this time.
            </p>
            <button
              className="btn btn-secondary"
              onClick={() => {
                setStage('identity')
                setResult(null)
                setDeadline(null)
                setRemainingSec(null)
              }}
            >
              Try again
            </button>
          </div>
        )}
      </div>
    )
  }

  if (stage === 'questions') {
    return (
      <div className="glass-card" style={{ padding: '28px 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
          <h3 style={{ fontSize: '18px', margin: 0 }}>Eligibility Assessment</h3>
          {remainingSec != null && (
            <span
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 700, fontSize: '14px',
                color: remainingSec < 30 ? 'var(--danger)' : 'var(--text-secondary)',
              }}
            >
              <Clock size={16} /> {mm}:{ss}
            </span>
          )}
        </div>

        {error && (
          <div role="alert" style={{ background: 'var(--danger-bg)', border: '1px solid var(--danger-border)', color: 'var(--danger)', padding: '12px', borderRadius: '8px', marginBottom: '16px', fontSize: '14px' }}>
            {error}
          </div>
        )}

        <form onSubmit={submitAssessment}>
          {questions.map((q) => {
            const id = `aq-${q.id}`
            const value = answers[q.id]
            const asText = typeof value === 'string' ? value : ''
            const star = q.required ? <span style={{ color: 'var(--danger)' }}> *</span> : null

            if (q.type === 'paragraph' || q.type === 'short') {
              return (
                <div key={q.id} style={{ marginBottom: '18px' }}>
                  <label htmlFor={id} style={labelStyle}>{q.label}{star}</label>
                  {q.type === 'paragraph' ? (
                    <textarea id={id} className="premium-input" rows={3} maxLength={2000} required={q.required} value={asText} onChange={(e) => setAnswer(q.id, e.target.value)} />
                  ) : (
                    <input id={id} type="text" className="premium-input" maxLength={300} required={q.required} value={asText} onChange={(e) => setAnswer(q.id, e.target.value)} />
                  )}
                </div>
              )
            }
            if (q.type === 'dropdown') {
              return (
                <div key={q.id} style={{ marginBottom: '18px' }}>
                  <label htmlFor={id} style={labelStyle}>{q.label}{star}</label>
                  <select id={id} className="premium-input" required={q.required} value={asText} onChange={(e) => setAnswer(q.id, e.target.value)}>
                    <option value="">Select…</option>
                    {q.options?.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
              )
            }
            if (q.type === 'checkbox') {
              return (
                <fieldset key={q.id} style={{ border: 'none', padding: 0, margin: '0 0 18px' }}>
                  <legend style={labelStyle}>{q.label}{star}</legend>
                  <div style={{ display: 'grid', gap: '8px' }}>
                    {q.options?.map((o) => (
                      <label key={o} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', cursor: 'pointer' }}>
                        <input type="checkbox" checked={Array.isArray(value) && value.includes(o)} onChange={() => toggleCheckbox(q.id, o)} /> {o}
                      </label>
                    ))}
                  </div>
                </fieldset>
              )
            }
            // radio / yesno
            return (
              <fieldset key={q.id} style={{ border: 'none', padding: 0, margin: '0 0 18px' }}>
                <legend style={labelStyle}>{q.label}{star}</legend>
                <div style={{ display: 'grid', gap: '8px' }}>
                  {q.options?.map((o) => (
                    <label key={o} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', cursor: 'pointer' }}>
                      <input type="radio" name={id} value={o} checked={value === o} onChange={() => setAnswer(q.id, o)} /> {o}
                    </label>
                  ))}
                </div>
              </fieldset>
            )
          })}

          <button type="submit" disabled={busy} className="btn btn-primary" style={{ width: '100%', padding: '14px' }}>
            {busy ? 'Submitting…' : 'Submit Assessment'}
          </button>
        </form>
      </div>
    )
  }

  return (
    <div className="glass-card" style={{ padding: '28px 24px' }}>
      <h3 style={{ fontSize: '18px', marginBottom: '16px' }}>Eligibility Assessment</h3>
      {error && (
        <div role="alert" style={{ background: 'var(--danger-bg)', border: '1px solid var(--danger-border)', color: 'var(--danger)', padding: '12px', borderRadius: '8px', marginBottom: '16px', fontSize: '14px' }}>
          {error}
        </div>
      )}
      <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '18px' }}>
        Confirm your details to begin. This determines your eligibility for this internship.
      </p>
      <form onSubmit={startAssessment}>
        <div style={{ marginBottom: '16px' }}>
          <label htmlFor="as-name" style={labelStyle}>Full name <span style={{ color: 'var(--danger)' }}>*</span></label>
          <input id="as-name" className="premium-input" value={fullName} onChange={(e) => setFullName(e.target.value)} required minLength={2} maxLength={100} autoComplete="name" />
        </div>
        <div style={{ marginBottom: '16px' }}>
          <label htmlFor="as-email" style={labelStyle}>Email <span style={{ color: 'var(--danger)' }}>*</span></label>
          <input id="as-email" type="email" className="premium-input" value={email} onChange={(e) => setEmail(e.target.value)} required maxLength={254} autoComplete="email" />
        </div>
        <div style={{ marginBottom: '20px' }}>
          <label htmlFor="as-phone" style={labelStyle}>Mobile number <span style={{ color: 'var(--danger)' }}>*</span></label>
          <input id="as-phone" type="tel" inputMode="numeric" className="premium-input" value={phone} onChange={(e) => setPhone(e.target.value)} required maxLength={20} autoComplete="tel" placeholder="10-digit mobile number" />
        </div>
        <button type="submit" disabled={busy} className="btn btn-primary" style={{ width: '100%', padding: '14px' }}>
          {busy ? 'Starting…' : 'Start Assessment'}
        </button>
      </form>
    </div>
  )
}
