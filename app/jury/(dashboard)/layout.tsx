'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { LayoutDashboard, Send, Sliders, Gavel, Trophy, User } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { RoleLoginGate } from '@/components/auth/RoleLoginGate'
import { SideDrawer } from '@/components/dashboard/SideDrawer'

type AuthState = 'loading' | 'unauthenticated' | 'jury'

const navItems = [
  { href: '/jury', label: 'Dashboard', icon: <LayoutDashboard size={18} /> },
  { href: '/jury/submissions', label: 'Assigned Submissions', icon: <Send size={18} /> },
  { href: '/jury/scoring', label: 'Scoring', icon: <Sliders size={18} /> },
  { href: '/results', label: 'Results', icon: <Trophy size={18} /> },
  { href: '/profile', label: 'Profile', icon: <User size={18} /> },
]

export default function JuryDashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const supabase = createClient()
  const [authState, setAuthState] = useState<AuthState>('loading')

  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setAuthState('unauthenticated')
      return
    }
    const { data } = await supabase.from('users').select('role').eq('id', user.id).single()
    if (data?.role !== 'jury') {
      router.push('/access-denied?area=jury')
      return
    }
    setAuthState('jury')
  }

  if (authState === 'loading') {
    return (
      <div style={{ padding: '100px 20px', textAlign: 'center', fontSize: '18px', color: 'var(--text-secondary)' }}>
        Loading...
      </div>
    )
  }

  if (authState === 'unauthenticated') {
    return (
      <RoleLoginGate
        icon={<Gavel size={32} />}
        title="Jury Sign In"
        subtitle="Log in to evaluate your assigned teams."
        registerHref="/jury/register"
        registerLabel="Don't have an account? Register as Jury"
        onAuthenticated={checkAuth}
      />
    )
  }

  return (
    <SideDrawer navItems={navItems} title="Jury Console">
      {children}
    </SideDrawer>
  )
}
