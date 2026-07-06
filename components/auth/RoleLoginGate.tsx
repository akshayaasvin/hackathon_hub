'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

/**
 * A branded, role-specific login form rendered IN PLACE at a protected route
 * (e.g. /admin, /jury) when no session exists — instead of redirecting to the
 * shared /login page. Does not navigate on success; the caller re-checks auth
 * state via onAuthenticated and decides what to render next (dashboard vs.
 * access-denied, if the credentials belonged to a different role).
 */
export function RoleLoginGate({
  icon,
  title,
  subtitle,
  accentColor = 'var(--primary)',
  registerHref,
  registerLabel,
  onAuthenticated,
}: {
  icon?: React.ReactNode
  title: string
  subtitle: string
  accentColor?: string
  registerHref?: string
  registerLabel?: string
  onAuthenticated: () => void
}) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const supabase = createClient()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
      if (signInError) throw signInError
      onAuthenticated()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        minHeight: 'calc(100vh - 64px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 16px',
      }}
    >
      <div className="glass-card fade-in" style={{ width: '100%', maxWidth: '400px', padding: '40px 32px' }}>
        {icon && (
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px', color: accentColor }}>
            {icon}
          </div>
        )}
        <h2
          style={{
            textAlign: 'center',
            marginBottom: '8px',
            fontSize: '26px',
            color: 'var(--text-primary)',
            fontFamily: 'var(--font-display)',
          }}
        >
          {title}
        </h2>
        <p style={{ textAlign: 'center', color: 'var(--text-muted)', marginBottom: '28px', fontSize: '14px' }}>
          {subtitle}
        </p>

        {error && (
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
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '18px' }}>
            <input
              type="email"
              placeholder="Email Address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="premium-input"
            />
          </div>
          <div style={{ marginBottom: '28px' }}>
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="premium-input"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary"
            style={{ width: '100%', padding: '14px', background: accentColor !== 'var(--primary)' ? accentColor : undefined }}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        {registerHref && (
          <p style={{ textAlign: 'center', marginTop: '24px', fontSize: '14px', color: 'var(--text-secondary)' }}>
            <a href={registerHref} style={{ color: 'var(--primary)', textDecoration: 'none', fontWeight: 600 }}>
              {registerLabel}
            </a>
          </p>
        )}
      </div>
    </div>
  )
}
