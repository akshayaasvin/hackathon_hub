'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Code, Gavel, Trophy, UserPlus, Video } from 'lucide-react'

// Hero showcase. Deliberately built from real, readable text and vector icons —
// no external image files, so it can never fail to load or look blank.

const steps = [
  { icon: <UserPlus size={18} />, title: 'Register & form a team', desc: 'Sign up and team up with up to four collaborators.', color: '#6C47FF' },
  { icon: <Code size={18} />, title: 'Build & submit', desc: 'Ship your repo, demo video and pitch deck.', color: '#3B82F6' },
  { icon: <Gavel size={18} />, title: 'Get judged by experts', desc: 'A transparent 100-point rubric scores every project.', color: '#0891B2' },
  { icon: <Trophy size={18} />, title: 'Win prizes & certificates', desc: 'Cash prizes and a verifiable certificate.', color: '#059669' },
]

interface NextWebinar {
  id: string
  title: string
  startsAt: string | null
  fee: number
  currency: string
}

export default function HeroIllustration() {
  const [webinar, setWebinar] = useState<NextWebinar | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/webinar', { cache: 'no-store' })
      .then((res) => res.json())
      .then((json) => {
        if (!cancelled && json?.success && json.data.webinars.length > 0) setWebinar(json.data.webinars[0])
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div style={{ width: '100%', maxWidth: '460px', margin: '0 auto', textAlign: 'left' }}>
      <p style={{ fontSize: '12px', fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--primary)', marginBottom: '18px' }}>
        Your path to the podium
      </p>

      <ol style={{ listStyle: 'none', margin: 0, padding: 0, position: 'relative' }}>
        {steps.map((s, i) => (
          <li key={s.title} style={{ display: 'flex', gap: '14px', position: 'relative', paddingBottom: i === steps.length - 1 ? 0 : '18px' }}>
            {i < steps.length - 1 && (
              <span style={{ position: 'absolute', left: '19px', top: '40px', bottom: '0', width: '2px', background: 'linear-gradient(to bottom, rgba(108,71,255,0.35), rgba(108,71,255,0.08))' }} />
            )}
            <span
              style={{
                width: 40, height: 40, borderRadius: '12px', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', background: s.color, boxShadow: `0 8px 18px -8px ${s.color}`,
              }}
            >
              {s.icon}
            </span>
            <span>
              <span style={{ display: 'block', fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.3 }}>
                {i + 1}. {s.title}
              </span>
              <span style={{ display: 'block', fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.5, marginTop: '2px' }}>{s.desc}</span>
            </span>
          </li>
        ))}
      </ol>

      {/* Webinar highlight — real data when a webinar is published, a generic invite otherwise */}
      <Link
        href="/webinar"
        style={{
          display: 'block', marginTop: '26px', padding: '18px 20px', borderRadius: '16px', textDecoration: 'none',
          color: '#fff', background: 'linear-gradient(135deg, #6C47FF 0%, #8B5CF6 60%, #A78BFA 100%)',
          boxShadow: '0 16px 32px -14px rgba(108,71,255,0.65)',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', opacity: 0.95, marginBottom: '8px' }}>
          <span className="live-dot" /> <Video size={14} /> Live webinar
        </span>
        <span style={{ display: 'block', fontSize: '17px', fontWeight: 700, lineHeight: 1.35 }}>
          {webinar ? webinar.title : 'Learn from industry experts, live'}
        </span>
        {webinar?.startsAt && (
          <span style={{ display: 'block', fontSize: '13px', opacity: 0.9, marginTop: '4px' }}>
            {new Date(webinar.startsAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' })} IST
            {' · '}
            {webinar.fee > 0 ? `₹${webinar.fee}` : 'Free'}
          </span>
        )}
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', marginTop: '12px', fontSize: '14px', fontWeight: 700 }}>
          Reserve your spot <ArrowRight size={16} />
        </span>
      </Link>
    </div>
  )
}
