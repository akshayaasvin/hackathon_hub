'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient, signOutAndRedirect } from '@/lib/supabase/client'

const dashboardByRole: Record<string, string> = {
  admin: '/admin',
  jury: '/jury',
  college: '/college',
  participant: '/participant',
}

const areaMessage: Record<string, string> = {
  admin: "You're signed in, but this account doesn't have Administrator access.",
  jury: "You're signed in, but this account doesn't have Jury access.",
  college: "You're signed in, but this account doesn't have Institution access.",
}

function AccessDeniedContent() {
  const searchParams = useSearchParams()
  const supabase = createClient()
  const [ownDashboard, setOwnDashboard] = useState('/participant')

  const area = searchParams.get('area') || ''
  const message = areaMessage[area] || "You're signed in, but this account doesn't have access to that area."

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const { data } = await supabase.from('users').select('role').eq('id', user.id).single()
      setOwnDashboard(dashboardByRole[data?.role || 'participant'])
    })
  }, [])

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
        <div style={{ fontSize: '40px', marginBottom: '12px' }}>🚫</div>
        <h2 style={{ fontSize: '26px', marginBottom: '12px', fontFamily: 'var(--font-display)' }}>
          Access Denied
        </h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', lineHeight: 1.6 }}>
          {message} If you believe this is a mistake, contact an administrator.
        </p>
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <a href={ownDashboard} className="btn btn-primary" style={{ padding: '12px 28px' }}>
            Go to My Dashboard
          </a>
          <button onClick={handleSignOut} className="btn btn-secondary" style={{ padding: '12px 28px' }}>
            Sign Out
          </button>
        </div>
      </div>
    </div>
  )
}

export default function AccessDeniedPage() {
  return (
    <Suspense fallback={null}>
      <AccessDeniedContent />
    </Suspense>
  )
}
