'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../lib/supabase/client'

export function AuthForm({ isLogin }: { isLogin: boolean }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const supabase = createClient()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      if (isLogin) {
        // Sign in
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        })
        if (error) throw error
        
        // Get the logged in user
        const { data: { user } } = await supabase.auth.getUser()
        
        if (user) {
          // Get user role from database
          const { data: userData } = await supabase
            .from('users')
            .select('role')
            .eq('id', user.id)
            .single()
          
          const role = userData?.role || 'participant'
          
          // Redirect based on role
          if (role === 'admin') router.push('/admin')
          else if (role === 'jury') router.push('/jury')
          else if (role === 'college') router.push('/college')
          else router.push('/participant')
        } else {
          router.push('/participant')
        }
        
        router.refresh()
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
              role: 'participant',
            },
          },
        })
        if (error) throw error
        
        if (data?.session) {
          // Email confirmation is disabled, user is logged in immediately.
          // Create the public.users profile row
          await supabase.from('users').insert({
            id: data.user.id,
            email: data.user.email,
            full_name: fullName,
            role: data.user.user_metadata?.role || 'participant',
            created_at: new Date().toISOString()
          })
          
          alert('Registration successful! Logging in...')
          router.push('/participant')
        } else {
          // Email confirmation is enabled, try to insert profile row (will be created on login if RLS blocks anonymous inserts)
          try {
            await supabase.from('users').insert({
              id: data.user?.id,
              email: data.user?.email || email,
              full_name: fullName,
              role: data.user?.user_metadata?.role || 'participant',
              created_at: new Date().toISOString()
            })
          } catch (e) {
            console.warn('Profile creation deferred to login verification.')
          }
          alert('Registration successful! Please check your email for verification.')
          router.push('/login')
        }
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="glass-card fade-in" style={{
      width: '100%',
      maxWidth: '400px',
      padding: '40px 32px'
    }}>
      <h2 style={{ 
        textAlign: 'center', 
        marginBottom: '28px',
        fontSize: '28px',
        color: 'var(--text-primary)',
        fontFamily: 'var(--font-display)'
      }}>
        {isLogin ? 'Login to Dashboard' : 'Create Account'}
      </h2>
      
      {error && (
        <div style={{
          background: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.2)',
          color: 'var(--danger)',
          padding: '12px',
          borderRadius: '8px',
          marginBottom: '20px',
          fontSize: '14px',
          textAlign: 'center'
        }}>
          {error}
        </div>
      )}
      
      <form onSubmit={handleSubmit}>
        {!isLogin && (
          <div style={{ marginBottom: '18px' }}>
            <input
              type="text"
              placeholder="Full Name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              className="premium-input"
            />
          </div>
        )}
        
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
          style={{ width: '100%', padding: '14px' }}
        >
          {loading ? 'Processing...' : (isLogin ? 'Sign In' : 'Register')}
        </button>
      </form>
      
      <p style={{ textAlign: 'center', marginTop: '24px', fontSize: '14px', color: 'var(--text-secondary)' }}>
        <a href={isLogin ? '/register' : '/login'} style={{ color: 'var(--primary)', textDecoration: 'none', fontWeight: 600 }}>
          {isLogin ? "Don't have an account? Sign Up" : 'Already have an account? Sign In'}
        </a>
      </p>
    </div>
  )
}