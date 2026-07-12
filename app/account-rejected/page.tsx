'use client'

import { signOutAndRedirect } from '@/lib/supabase/client'

export default function AccountRejectedPage() {
  const handleSignOut = () => signOutAndRedirect('/login')

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
      <div className="glass-card fade-in" style={{ width: '100%', maxWidth: '460px', padding: '40px 32px', textAlign: 'center' }}>
        <div style={{ fontSize: '40px', marginBottom: '12px' }}>✕</div>
        <h2 style={{ fontSize: '26px', marginBottom: '12px', fontFamily: 'var(--font-display)' }}>
          Registration not approved
        </h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', lineHeight: 1.6 }}>
          Your registration wasn't approved by the admin team. If you think this is a mistake, reach out to
          the organizers for details.
        </p>
        <button onClick={handleSignOut} className="btn btn-secondary" style={{ padding: '12px 28px' }}>
          Sign Out
        </button>
      </div>
    </div>
  )
}
