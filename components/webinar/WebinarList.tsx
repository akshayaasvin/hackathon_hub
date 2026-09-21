'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowUpRight, CalendarDays, CheckCircle2, Video } from 'lucide-react'
import CopyLinkButton from '@/components/webinar/CopyLinkButton'

interface ListedWebinar {
  id: string
  title: string
  description: string | null
  startsAt: string | null
  fee: number
  currency: string
  registered: boolean
  joinUrl: string | null
}

const money = (amount: number, currency: string) => {
  try {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 2 }).format(amount)
  } catch {
    return `${currency} ${amount}`
  }
}

/**
 * Published webinars as cards. Used on the home page (variant "landing": renders
 * nothing at all when there are none) and in the participant dashboard (variant
 * "dashboard": shows a friendly empty state). Both link to /webinar to register.
 */
export default function WebinarList({ variant }: { variant: 'landing' | 'dashboard' }) {
  const [webinars, setWebinars] = useState<ListedWebinar[] | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/webinar', { cache: 'no-store' })
      .then((res) => res.json())
      .then((json) => {
        if (!cancelled) setWebinars(json?.success ? json.data.webinars : [])
      })
      .catch(() => {
        if (!cancelled) setWebinars([])
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (webinars === null) return null

  const cards =
    webinars.length === 0 ? (
      <div className="glass-card" style={{ textAlign: 'center', padding: '40px 24px', color: 'var(--text-secondary)' }}>
        No webinars are open for registration right now.
      </div>
    ) : (
      <div className="responsive-card-grid">
        {webinars.map((w) => (
          <div key={w.id} className="glass-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', textAlign: 'left' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', marginBottom: '12px' }}>
                <h3 style={{ fontSize: '18px', color: 'var(--text-primary)' }}>{w.title}</h3>
                <span style={{ fontWeight: 700, whiteSpace: 'nowrap', color: w.fee > 0 ? 'var(--primary)' : 'var(--success)' }}>
                  {w.fee > 0 ? money(w.fee, w.currency) : 'Free'}
                </span>
              </div>
              {w.startsAt && (
                <p style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--text-muted)', marginBottom: '12px' }}>
                  <CalendarDays size={14} />
                  {new Date(w.startsAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' })} IST
                </p>
              )}
              {w.description && (
                <p
                  style={{
                    color: 'var(--text-secondary)',
                    fontSize: '14px',
                    lineHeight: 1.6,
                    marginBottom: '18px',
                    display: '-webkit-box',
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}
                >
                  {w.description}
                </p>
              )}
            </div>
            {w.registered ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--success)', fontWeight: 600, fontSize: '14px' }}>
                  <CheckCircle2 size={16} /> You&apos;re registered
                </span>
                {w.joinUrl && (
                  <span style={{ display: 'inline-flex', gap: '8px', flexWrap: 'wrap' }}>
                    <a href={w.joinUrl} target="_blank" rel="noopener noreferrer" className="btn btn-primary" style={{ padding: '8px 16px', fontSize: '13px', display: 'inline-flex', gap: '6px' }}>
                      <Video size={14} /> Join
                    </a>
                    <CopyLinkButton url={w.joinUrl} small />
                  </span>
                )}
              </div>
            ) : (
              <Link href="/webinar" style={{ color: 'var(--primary)', fontWeight: 600, fontSize: '14px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                Register now <ArrowUpRight size={14} />
              </Link>
            )}
          </div>
        ))}
      </div>
    )

  if (variant === 'landing') {
    if (webinars.length === 0) return null
    return (
      <div id="webinars" className="premium-container" style={{ width: '100%' }}>
        <div className="webinar-section-card">
          <span className="webinar-badge">
            <span className="live-dot" /> New · Live sessions
          </span>
          <h2 className="section-title">Upcoming Webinars</h2>
          <p className="section-subtitle">Learn live from the HackathonHub community — reserve your spot before it fills up.</p>
          <div style={{ marginBottom: '16px' }}>{cards}</div>
        </div>
      </div>
    )
  }

  return cards
}
