'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { CalendarDays, CheckCircle2, Clock, GraduationCap, Loader2, MapPin, Users } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import CopyLinkButton from '@/components/webinar/CopyLinkButton'
import { openRazorpayCheckout, verifyPaymentOnServer, type RazorpayCheckoutResult } from '@/components/RazorpayCheckout'
import AssessmentRunner from './AssessmentRunner'
import RegistrationForm from './RegistrationForm'

interface InternshipDetails {
  id: string
  title: string
  topic: string | null
  description: string | null
  category: string | null
  skillsRequired: string[]
  eligibilityText: string | null
  durationText: string | null
  mode: string
  startDate: string | null
  applicationDeadline: string | null
  seatsAvailable: number | null
  isPaid: boolean
  fee: number
  currency: string
  bannerUrl: string | null
  assessment: { enabled: boolean; questionCount?: number; passingScorePercent?: number; timeLimitMinutes?: number | null }
  formConfig: { fixedFields: any[]; questions: any[] }
}

type Phase = 'loading' | 'error' | 'details' | 'assessment' | 'registration' | 'confirming' | 'delayed' | 'done'

const money = (amount: number, currency: string) => {
  try {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount)
  } catch {
    return `${currency} ${amount}`
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

async function fetchRegistrationStatus(registrationId: string, token: string) {
  try {
    const res = await fetch(`/api/internship/registrations/${registrationId}/status?token=${encodeURIComponent(token)}`, { cache: 'no-store' })
    const json = await res.json()
    return json?.success ? json.data : null
  } catch {
    return null
  }
}

export default function InternshipFlow({ internshipId, autoStart }: { internshipId: string; autoStart?: boolean }) {
  const [phase, setPhase] = useState<Phase>('loading')
  const [details, setDetails] = useState<InternshipDetails | null>(null)
  const [loadError, setLoadError] = useState('')
  const [prefill, setPrefill] = useState({ fullName: '', email: '', phone: '' })
  const [carry, setCarry] = useState<{ registrationId: string; accessToken: string } | null>(null)
  const [confirmed, setConfirmed] = useState<{ registrationCode: string; status: string } | null>(null)
  const [pendingCode, setPendingCode] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/internship/${internshipId}`, { cache: 'no-store' })
      .then((res) => res.json())
      .then((json) => {
        if (cancelled) return
        if (!json?.success) {
          setLoadError(json?.message || 'This internship could not be found.')
          setPhase('error')
          return
        }
        setDetails(json.data)
        // "Register Now" from the list page (?start=1) skips straight past the details
        // screen into the flow — unless seats are full, in which case there's nothing to start.
        const seatsFull = json.data.seatsAvailable != null && json.data.seatsAvailable <= 0
        setPhase(autoStart && !seatsFull ? (json.data.assessment?.enabled ? 'assessment' : 'registration') : 'details')
      })
      .catch(() => {
        if (!cancelled) {
          setLoadError('Could not load this internship. Please refresh.')
          setPhase('error')
        }
      })
    return () => {
      cancelled = true
    }
  }, [internshipId])

  // Best-effort prefill for a signed-in visitor (login is never required to apply).
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      setPrefill((p) => ({ ...p, email: p.email || user.email || '' }))
      const { data } = await supabase.from('users').select('full_name').eq('id', user.id).maybeSingle()
      if (data?.full_name) setPrefill((p) => ({ ...p, fullName: p.fullName || data.full_name }))
    })
  }, [])

  const waitForConfirmation = async (registrationId: string, token: string) => {
    const deadline = Date.now() + 60_000
    while (Date.now() < deadline) {
      const status = await fetchRegistrationStatus(registrationId, token)
      if (status && status.status !== 'payment_pending') {
        setConfirmed({ registrationCode: status.registrationCode, status: status.status })
        setPhase('done')
        return
      }
      await sleep(3000)
    }
    setPhase('delayed')
  }

  const handleRegistered = async (result: {
    registrationId: string
    registrationCode: string
    accessToken: string
    paymentRequired: boolean
    order?: any
  }) => {
    if (!result.paymentRequired) {
      setConfirmed({ registrationCode: result.registrationCode, status: 'registered' })
      setPhase('done')
      return
    }
    setPendingCode(result.registrationCode)
    try {
      await openRazorpayCheckout(result.order, {
        name: prefill.fullName,
        email: prefill.email,
        contact: prefill.phone,
        description: `${details?.title ?? 'Internship'} — registration`,
        onSuccess: async (checkoutResult: RazorpayCheckoutResult) => {
          setPhase('confirming')
          await verifyPaymentOnServer(checkoutResult)
          await waitForConfirmation(result.registrationId, result.accessToken)
        },
        onDismiss: () => {},
        onFailure: () => {},
      })
    } catch (err) {
      console.error('[internship] could not open checkout:', err)
    }
  }

  if (phase === 'loading') {
    return (
      <div className="glass-card" style={{ textAlign: 'center', padding: '60px 24px' }}>
        <Loader2 size={28} style={{ animation: 'spin 1s linear infinite', color: 'var(--primary)' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    )
  }

  if (phase === 'error') {
    return (
      <div className="glass-card" style={{ textAlign: 'center', padding: '48px 24px', borderLeft: '4px solid var(--danger)' }}>
        <h3 style={{ marginBottom: '8px' }}>{loadError}</h3>
        <Link href="/internship" className="btn btn-secondary" style={{ marginTop: '12px', display: 'inline-flex' }}>
          Browse internships
        </Link>
      </div>
    )
  }

  if (phase === 'confirming') {
    return (
      <div className="glass-card" role="status" style={{ textAlign: 'center', padding: '48px 24px' }}>
        <Loader2 size={32} style={{ color: 'var(--primary)', marginBottom: '14px', animation: 'spin 1s linear infinite' }} />
        <h3 style={{ marginBottom: '8px' }}>Confirming your payment…</h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>We&apos;re verifying it with Razorpay — please don&apos;t close this page.</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    )
  }

  if (phase === 'delayed') {
    return (
      <div className="glass-card" style={{ padding: '32px 24px', borderLeft: '4px solid var(--warning)' }}>
        <h3 style={{ marginBottom: '8px' }}>We have your payment — confirmation is taking a little longer</h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: 1.7 }}>
          Your Registration ID is <strong>{pendingCode}</strong>. It will confirm automatically — check{' '}
          <Link href="/internship/status" style={{ color: 'var(--primary)' }}>your application status</Link> in a minute.
        </p>
      </div>
    )
  }

  if (phase === 'done' && confirmed) {
    return (
      <div className="glass-card" style={{ padding: '36px 24px', borderLeft: '4px solid var(--success)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px', color: 'var(--success)' }}>
          <CheckCircle2 size={28} />
          <h2 style={{ fontSize: '24px', margin: 0 }}>Registration confirmed!</h2>
        </div>
        <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: '16px' }}>
          Thanks — your application for <strong>{details?.title}</strong> is complete. A confirmation has been emailed to{' '}
          <strong>{prefill.email}</strong>.
        </p>
        <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>Registration ID</div>
        <div
          style={{
            fontFamily: 'monospace', fontSize: '16px', fontWeight: 700, padding: '12px 16px', borderRadius: '10px', marginBottom: '14px',
            background: 'rgba(108,71,255,0.06)', border: '1px solid var(--border-color)', display: 'inline-block',
          }}
        >
          {confirmed.registrationCode}
        </div>
        <div style={{ marginBottom: '16px' }}>
          <CopyLinkButton url={confirmed.registrationCode} small />
        </div>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
          Keep this ID — use it with your email on the{' '}
          <Link href="/internship/status" style={{ color: 'var(--primary)' }}>status page</Link> to check your application anytime.
        </p>
      </div>
    )
  }

  if (!details) return null

  if (phase === 'assessment') {
    return (
      <AssessmentRunner
        internshipId={internshipId}
        prefill={prefill}
        onPassed={(registrationId, accessToken) => {
          setCarry({ registrationId, accessToken })
          setPhase('registration')
        }}
      />
    )
  }

  if (phase === 'registration') {
    return (
      <RegistrationForm
        internshipId={internshipId}
        fixedFields={details.formConfig.fixedFields}
        questions={details.formConfig.questions}
        prefill={prefill}
        carry={carry}
        onSubmitted={handleRegistered}
      />
    )
  }

  // 'details'
  const seatsFull = details.seatsAvailable != null && details.seatsAvailable <= 0
  return (
    <div style={{ display: 'grid', gap: '20px' }}>
      <div className="glass-card" style={{ padding: '32px 24px' }}>
        {details.bannerUrl && (
          <img src={details.bannerUrl} alt={details.title} style={{ width: '100%', maxHeight: '260px', objectFit: 'cover', borderRadius: '12px', marginBottom: '20px' }} />
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '14px', flexWrap: 'wrap', marginBottom: '12px' }}>
          <h1 style={{ fontSize: '26px', margin: 0 }}>{details.title}</h1>
          <span style={{ fontWeight: 700, fontSize: '18px', color: details.isPaid ? 'var(--primary)' : 'var(--success)' }}>
            {details.isPaid ? money(details.fee, details.currency) : 'Unpaid'}
          </span>
        </div>
        {details.topic && <p style={{ color: 'var(--text-muted)', marginBottom: '16px' }}>{details.topic}</p>}

        <div style={{ display: 'grid', gap: '8px', fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '18px' }}>
          {details.durationText && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Clock size={15} /> {details.durationText}</span>
          )}
          <span style={{ display: 'flex', alignItems: 'center', gap: '8px', textTransform: 'capitalize' }}><MapPin size={15} /> {details.mode}</span>
          {details.eligibilityText && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><GraduationCap size={15} /> {details.eligibilityText}</span>
          )}
          {details.startDate && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><CalendarDays size={15} /> Starts {new Date(details.startDate).toLocaleDateString()}</span>
          )}
          {details.applicationDeadline && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><CalendarDays size={15} /> Apply by {new Date(details.applicationDeadline).toLocaleDateString()}</span>
          )}
          {details.seatsAvailable != null && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Users size={15} /> {details.seatsAvailable} seat{details.seatsAvailable === 1 ? '' : 's'} available</span>
          )}
        </div>

        {details.description && <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7, whiteSpace: 'pre-line', marginBottom: '16px' }}>{details.description}</p>}

        {details.skillsRequired?.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '20px' }}>
            {details.skillsRequired.map((s) => (
              <span key={s} style={{ fontSize: '12px', fontWeight: 600, padding: '4px 10px', borderRadius: '20px', background: 'rgba(108,71,255,0.08)', color: 'var(--primary)' }}>
                {s}
              </span>
            ))}
          </div>
        )}

        {seatsFull ? (
          <p style={{ color: 'var(--danger)', fontWeight: 600 }}>All seats for this internship are currently filled.</p>
        ) : (
          <button
            className="btn btn-primary"
            style={{ padding: '14px 28px' }}
            onClick={() => setPhase(details.assessment.enabled ? 'assessment' : 'registration')}
          >
            {details.assessment.enabled ? 'Start Eligibility Assessment' : 'Register Now'}
          </button>
        )}
        {details.assessment.enabled && details.assessment.passingScorePercent != null && (
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '10px' }}>
            This internship requires passing an eligibility assessment ({details.assessment.passingScorePercent}% to pass
            {details.assessment.timeLimitMinutes ? `, ${details.assessment.timeLimitMinutes} minute time limit` : ''}).
          </p>
        )}
      </div>
    </div>
  )
}
