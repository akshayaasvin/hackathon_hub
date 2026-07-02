'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const supabase = createClient()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

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
      setError(err.message)
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
