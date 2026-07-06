'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function AuthErrorPage() {
  const router = useRouter()
  const supabase = createClient()

  const handleRetry = () => {
    router.refresh()
    router.push('/login')
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
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
      <div className="glass-card fade-in" style={{ width: '100%', maxWidth: '480px', padding: '40px 32px', textAlign: 'center' }}>
        <div style={{ fontSize: '40px', marginBottom: '12px' }}>⚠️</div>
        <h2 style={{ fontSize: '26px', marginBottom: '12px', fontFamily: 'var(--font-display)' }}>
          We couldn't verify your account
        </h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', lineHeight: 1.6 }}>
          Something went wrong looking up your account details just now — this is a temporary server-side
          issue, not something wrong with your login. Please try again in a moment. If this keeps
          happening, contact an administrator with the time you saw this.
        </p>
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <button onClick={handleRetry} className="btn btn-primary" style={{ padding: '12px 28px' }}>
            Try Again
          </button>
          <button onClick={handleSignOut} className="btn btn-secondary" style={{ padding: '12px 28px' }}>
            Sign Out
          </button>
        </div>
      </div>
    </div>
  )
}
