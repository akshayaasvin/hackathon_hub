'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { LayoutDashboard, Users, Send } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { SideDrawer } from '@/components/dashboard/SideDrawer'

type AuthState = 'loading' | 'ready'

const navItems = [
  { href: '/participant', label: 'Dashboard', icon: <LayoutDashboard size={18} /> },
  { href: '/participant/teams', label: 'My Teams', icon: <Users size={18} /> },
  { href: '/participant/submissions', label: 'Submissions', icon: <Send size={18} /> },
]

export default function ParticipantLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const supabase = createClient()
  const [authState, setAuthState] = useState<AuthState>('loading')

  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/login')
      return
    }
    setAuthState('ready')
  }

  if (authState === 'loading') {
    return (
      <div style={{ padding: '100px 20px', textAlign: 'center', fontSize: '18px', color: 'var(--text-secondary)' }}>
        Loading...
      </div>
    )
  }

  return (
    <SideDrawer navItems={navItems} title="Participant Console">
      {children}
    </SideDrawer>
  )
}
