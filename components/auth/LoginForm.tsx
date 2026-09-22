'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { PasswordInput } from '@/components/ui/PasswordInput'

export function LoginForm({ initialNotice }: { initialNotice?: { type: 'error' | 'success'; message: string } }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  // Cleared as soon as the visitor interacts with the form (submits, or the URL notice
  // wouldn't apply to whatever they're about to try) so it can't linger after they've moved on.
  const [notice, setNotice] = useState(initialNotice ?? null)
  const router = useRouter()
  const supabase = createClient()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setNotice(null)

    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
      if (signInError) throw signInError

      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        router.push('/login')
        return
      }

      const { data: userData } = await supabase
        .from('users')
        .select('role, status')
        .eq('id', user.id)
        .single()

      const role = userData?.role || 'participant'
      const status = userData?.status || 'pending'

      if (status === 'pending') {
        router.push('/pending-approval')
      } else if (status === 'rejected') {
        router.push('/account-rejected')
      } else if (role === 'admin') {
        router.push('/admin')
      } else if (role === 'jury') {
        router.push('/jury')
      } else if (role === 'college') {
        router.push('/college')
      } else {
        router.push('/participant')
      }

      router.refresh()
    } catch (err: any) {
      setError(
        /email not confirmed/i.test(err.message)
          ? 'This email hasn\'t been confirmed yet. Check your inbox for the confirmation link, or go to Register and submit the same email again to get a new one.'
          : err.message
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="glass-card fade-in" style={{ width: '100%', maxWidth: '400px', padding: '40px 32px' }}>
      <h2
        style={{
          textAlign: 'center',
          marginBottom: '28px',
          fontSize: '28px',
          color: 'var(--text-primary)',
          fontFamily: 'var(--font-display)',
        }}
      >
        Login to Dashboard
      </h2>

      {(error || notice) && (
        <div
          style={{
            ...(error || notice?.type === 'error'
              ? { background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', color: 'var(--danger)' }
              : { background: 'var(--success-bg)', border: '1px solid var(--success-border)', color: 'var(--success)' }),
            padding: '12px',
            borderRadius: '8px',
            marginBottom: '20px',
            fontSize: '14px',
            textAlign: 'center',
          }}
        >
          {error || notice?.message}
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
          <PasswordInput placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
        </div>

        <button type="submit" disabled={loading} className="btn btn-primary" style={{ width: '100%', padding: '14px' }}>
          {loading ? 'Signing in...' : 'Sign In'}
        </button>
      </form>

      <p style={{ textAlign: 'center', marginTop: '24px', fontSize: '14px', color: 'var(--text-secondary)' }}>
        <a href="/register" style={{ color: 'var(--primary)', textDecoration: 'none', fontWeight: 600 }}>
          Don&apos;t have an account? Sign Up
        </a>
      </p>
    </div>
  )
}
