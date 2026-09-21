'use client'

import { useEffect, useState } from 'react'
import { CalendarDays, CheckCircle2, Loader2, Video } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { postJson } from '@/lib/apiFetch'
import {
  openRazorpayCheckout,
  verifyPaymentOnServer,
  type RazorpayCheckoutResult,
  type RazorpayOrder,
} from '@/components/RazorpayCheckout'

export interface PublicWebinar {
  id: string
  title: string
  description: string | null
  startsAt: string | null
  fee: number
  currency: string
}

interface RegisterData {
  registrationId: string
  accessToken: string
  paymentRequired: boolean
  order?: RazorpayOrder
}

interface ConfirmedStatus {
  status: 'payment_pending' | 'paid' | 'free'
  fullName: string
  amount: number | null
  paymentId: string | null
  webinar: { title: string; startsAt: string | null; joinUrl: string | null } | null
}

type Phase = 'form' | 'confirming' | 'delayed' | 'done'

const money = (amount: number, currency: string) => {
  try {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 2 }).format(amount)
  } catch {
    return `${currency} ${amount}`
  }
}

const formatWhen = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString('en-IN', { dateStyle: 'full', timeStyle: 'short', timeZone: 'Asia/Kolkata' }) + ' IST'
    : null

async function fetchStatus(registrationId: string, token: string): Promise<ConfirmedStatus | null> {
  try {
    const res = await fetch(`/api/webinar/registrations/${registrationId}/status?token=${encodeURIComponent(token)}`, {
      cache: 'no-store',
    })
    const json = await res.json()
    return json?.success ? (json.data as ConfirmedStatus) : null
  } catch {
    return null
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export function WebinarRegistration({ webinars }: { webinars: PublicWebinar[] }) {
  const [selectedId, setSelectedId] = useState<string>(webinars.length === 1 ? webinars[0].id : '')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [phase, setPhase] = useState<Phase>('form')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [confirmed, setConfirmed] = useState<ConfirmedStatus | null>(null)
  const [pendingPaymentId, setPendingPaymentId] = useState<string | null>(null)
  const [resume, setResume] = useState<{ registrationId: string; token: string } | null>(null)

  const selected = webinars.find((w) => w.id === selectedId) || null

  // Signed-in participants get their details pre-filled (they can still edit them).
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      setEmail((current) => current || user.email || '')
      const { data } = await supabase.from('users').select('full_name').eq('id', user.id).maybeSingle()
      if (data?.full_name) setFullName((current) => current || data.full_name)
    })
  }, [])

  // Waits (up to ~60s) for the server to report the registration as confirmed. The server
  // itself re-checks Razorpay on every poll, so this works even if the webhook is late.
  const waitForConfirmation = async (registrationId: string, token: string) => {
    const deadline = Date.now() + 60_000
    while (Date.now() < deadline) {
      const status = await fetchStatus(registrationId, token)
      if (status && (status.status === 'paid' || status.status === 'free')) {
        setConfirmed(status)
        setPhase('done')
        return
      }
      await sleep(3000)
    }
    setPhase('delayed')
  }

  const onPaid = async (registrationId: string, token: string, result: RazorpayCheckoutResult) => {
    setPhase('confirming')
    setPendingPaymentId(result.razorpay_payment_id)
    setResume({ registrationId, token })
    await verifyPaymentOnServer(result) // server-side signature + Razorpay API check
    await waitForConfirmation(registrationId, token)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selected || busy) return
    setError(null)
    setNotice(null)
    setBusy(true)

    const res = await postJson<RegisterData>('/api/webinar/register', {
      webinarId: selected.id,
      fullName,
      email,
      phone,
    })
    if (!res.success || !res.data) {
      setError(res.message)
      setBusy(false)
      return
    }

    const { registrationId, accessToken, paymentRequired, order } = res.data

    if (!paymentRequired || !order) {
      // Free webinar: already confirmed server-side; just fetch the confirmation details.
      const status = await fetchStatus(registrationId, accessToken)
      if (status && (status.status === 'paid' || status.status === 'free')) {
        setConfirmed(status)
        setPhase('done')
      } else {
        setNotice('You are registered. A confirmation will be emailed to you shortly.')
      }
      setBusy(false)
      return
    }

    try {
      await openRazorpayCheckout(order, {
        name: fullName,
        email,
        contact: phone,
        description: `${selected.title} — registration`,
        onSuccess: (result) => {
          void onPaid(registrationId, accessToken, result).finally(() => setBusy(false))
        },
        onDismiss: () => {
          setBusy(false)
          setNotice('Payment was not completed, so your spot is not confirmed yet. Press the button again to resume.')
        },
        onFailure: () => {
          setNotice('That payment attempt failed. You can try again with the same or a different method.')
        },
      })
    } catch (err) {
      console.error('[webinar] could not open checkout:', err)
      setError('Could not open the payment window. Please check your connection and try again.')
      setBusy(false)
    }
  }

  if (phase === 'confirming') {
    return (
      <div className="glass-card" role="status" style={{ textAlign: 'center', padding: '48px 24px' }}>
        <Loader2 size={32} style={{ color: 'var(--primary)', marginBottom: '14px', animation: 'spin 1s linear infinite' }} />
        <h3 style={{ marginBottom: '8px' }}>Confirming your payment…</h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: 1.6 }}>
          We&apos;re verifying it with Razorpay. This usually takes a few seconds — please don&apos;t close this page.
        </p>
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    )
  }

  if (phase === 'delayed') {
    return (
      <div className="glass-card" role="status" style={{ padding: '36px 24px', borderLeft: '4px solid var(--warning)' }}>
        <h3 style={{ marginBottom: '8px' }}>We have your payment — confirmation is taking longer than usual</h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: 1.7, marginBottom: '14px' }}>
          Your payment went through and will be confirmed automatically. You&apos;ll receive an email at{' '}
          <strong>{email}</strong> as soon as it is. Keep this Payment ID for reference:{' '}
          <span style={{ fontFamily: 'monospace' }}>{pendingPaymentId}</span>
        </p>
        <button
          className="btn btn-primary"
          onClick={async () => {
            if (!resume) return
            setPhase('confirming')
            await waitForConfirmation(resume.registrationId, resume.token)
          }}
        >
          Check again
        </button>
      </div>
    )
  }

  if (phase === 'done' && confirmed) {
    const when = formatWhen(confirmed.webinar?.startsAt ?? null)
    return (
      <div className="glass-card" role="status" style={{ padding: '36px 24px', borderLeft: '4px solid var(--success)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px', color: 'var(--success)' }}>
          <CheckCircle2 size={28} />
          <h2 style={{ fontSize: '24px', margin: 0 }}>You&apos;re registered!</h2>
        </div>
        <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: '16px' }}>
          Thanks, {confirmed.fullName}. Your spot in <strong>{confirmed.webinar?.title}</strong> is confirmed. A confirmation has
          been emailed to <strong>{email}</strong>.
        </p>
        <div style={{ display: 'grid', gap: '8px', fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '20px' }}>
          {when && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CalendarDays size={16} /> {when}
            </span>
          )}
          {confirmed.paymentId && (
            <span>
              Payment ID: <span style={{ fontFamily: 'monospace' }}>{confirmed.paymentId}</span>
            </span>
          )}
        </div>
        {confirmed.webinar?.joinUrl && (
          <a href={confirmed.webinar.joinUrl} target="_blank" rel="noopener noreferrer" className="btn btn-primary" style={{ display: 'inline-flex', gap: '8px' }}>
            <Video size={16} /> Join the webinar
          </a>
        )}
      </div>
    )
  }

  return (
    <div style={{ display: 'grid', gap: '20px' }}>
      {webinars.length > 1 && (
        <div style={{ display: 'grid', gap: '12px' }}>
          {webinars.map((w) => {
            const active = w.id === selectedId
            return (
              <button
                key={w.id}
                type="button"
                onClick={() => setSelectedId(w.id)}
                className="glass-card"
                aria-pressed={active}
                style={{
                  textAlign: 'left',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  border: active ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                }}
              >
                <WebinarSummary webinar={w} />
              </button>
            )
          })}
        </div>
      )}

      {selected && (
        <div className="glass-card" style={{ padding: '28px 24px' }}>
          {webinars.length === 1 && <WebinarSummary webinar={selected} />}
          <form onSubmit={handleSubmit} style={{ marginTop: webinars.length === 1 ? '24px' : 0 }}>
            <h3 style={{ fontSize: '18px', marginBottom: '16px' }}>Your details</h3>

            {error && (
              <div role="alert" style={{ background: 'var(--danger-bg)', border: '1px solid var(--danger-border)', color: 'var(--danger)', padding: '12px', borderRadius: '8px', marginBottom: '16px', fontSize: '14px' }}>
                {error}
              </div>
            )}
            {notice && (
              <div role="status" style={{ background: 'var(--warning-bg)', border: '1px solid var(--warning-border)', color: 'var(--text-secondary)', padding: '12px', borderRadius: '8px', marginBottom: '16px', fontSize: '14px' }}>
                {notice}
              </div>
            )}

            <div style={{ marginBottom: '16px' }}>
              <label htmlFor="wb-name" style={{ display: 'block', marginBottom: '6px', fontWeight: 600, fontSize: '14px', color: 'var(--text-secondary)' }}>
                Full name
              </label>
              <input id="wb-name" className="premium-input" value={fullName} onChange={(e) => setFullName(e.target.value)} required minLength={2} maxLength={100} autoComplete="name" />
            </div>
            <div style={{ marginBottom: '16px' }}>
              <label htmlFor="wb-email" style={{ display: 'block', marginBottom: '6px', fontWeight: 600, fontSize: '14px', color: 'var(--text-secondary)' }}>
                Email
              </label>
              <input id="wb-email" type="email" className="premium-input" value={email} onChange={(e) => setEmail(e.target.value)} required maxLength={254} autoComplete="email" />
            </div>
            <div style={{ marginBottom: '24px' }}>
              <label htmlFor="wb-phone" style={{ display: 'block', marginBottom: '6px', fontWeight: 600, fontSize: '14px', color: 'var(--text-secondary)' }}>
                WhatsApp / mobile number
              </label>
              <input id="wb-phone" type="tel" inputMode="numeric" className="premium-input" value={phone} onChange={(e) => setPhone(e.target.value)} required maxLength={20} autoComplete="tel" placeholder="10-digit mobile number" />
            </div>

            <button type="submit" disabled={busy} className="btn btn-primary" style={{ width: '100%', padding: '14px' }}>
              {busy ? 'Please wait…' : selected.fee > 0 ? `Pay ${money(selected.fee, selected.currency)} & Register` : 'Register for free'}
            </button>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center', marginTop: '12px' }}>
              {selected.fee > 0 ? 'Secure payment by Razorpay. ' : ''}Your registration is confirmed by email.
            </p>
          </form>
        </div>
      )}
    </div>
  )
}

function WebinarSummary({ webinar }: { webinar: PublicWebinar }) {
  const when = formatWhen(webinar.startsAt)
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap' }}>
        <h2 style={{ fontSize: '22px', margin: 0 }}>{webinar.title}</h2>
        <span style={{ fontWeight: 700, color: webinar.fee > 0 ? 'var(--primary)' : 'var(--success)' }}>
          {webinar.fee > 0 ? money(webinar.fee, webinar.currency) : 'Free'}
        </span>
      </div>
      {when && (
        <p style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', fontSize: '14px', marginTop: '8px' }}>
          <CalendarDays size={16} /> {when}
        </p>
      )}
      {webinar.description && (
        <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7, fontSize: '14px', marginTop: '10px', whiteSpace: 'pre-line' }}>{webinar.description}</p>
      )}
    </div>
  )
}
