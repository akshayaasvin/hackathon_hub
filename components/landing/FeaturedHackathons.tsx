'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Calendar, ArrowUpRight, Rocket } from 'lucide-react'
import type { Hackathon } from '@/types'

export default function FeaturedHackathons() {
  const [hackathons, setHackathons] = useState<Hackathon[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('hackathons')
      .select('*')
      .in('status', ['published', 'ongoing'])
      .order('registration_deadline', { ascending: true })
      .limit(3)
      .then(({ data }) => {
        setHackathons(data || [])
        setLoading(false)
      })
  }, [])

  if (loading) return null

  if (hackathons.length === 0) {
    return (
      <div className="glass-card" style={{ textAlign: 'center', padding: '48px 32px', maxWidth: '560px', margin: '0 auto' }}>
        <Rocket size={28} color="var(--primary)" style={{ marginBottom: '12px' }} />
        <p style={{ color: 'var(--text-secondary)', fontSize: '15px' }}>
          New hackathons launching soon — register now and you'll be first to know.
        </p>
      </div>
    )
  }

  return (
    <div className="responsive-card-grid">
      {hackathons.map((h) => (
        <div key={h.id} className="glass-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <span
              style={{
                display: 'inline-block',
                fontSize: '11px',
                fontWeight: 700,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: h.status === 'ongoing' ? 'var(--success)' : 'var(--primary)',
                background: h.status === 'ongoing' ? 'var(--success-bg)' : 'var(--primary-glow)',
                padding: '4px 10px',
                borderRadius: '20px',
                marginBottom: '14px',
              }}
            >
              {h.status === 'ongoing' ? 'Live Now' : h.theme || 'Open Innovation'}
            </span>
            <h3 style={{ fontSize: '18px', color: 'var(--text-primary)', marginBottom: '10px' }}>{h.name}</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: '1.6', marginBottom: '18px' }}>
              {h.description || 'Details coming soon.'}
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--text-muted)', marginBottom: '20px' }}>
              <Calendar size={14} />
              Registration closes {new Date(h.registration_deadline).toLocaleDateString()}
            </div>
          </div>
          <a
            href="/register"
            style={{ color: 'var(--primary)', fontWeight: 600, fontSize: '14px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            Register now <ArrowUpRight size={14} />
          </a>
        </div>
      ))}
    </div>
  )
}
