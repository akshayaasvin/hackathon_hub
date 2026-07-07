'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { LayoutDashboard, Users, Trophy } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { SideDrawer } from '@/components/dashboard/SideDrawer'

type AuthState = 'loading' | 'unauthenticated' | 'college'

const navItems = [
  { href: '/college', label: 'Dashboard', icon: <LayoutDashboard size={18} /> },
  { href: '/college/students', label: 'Registered Students', icon: <Users size={18} /> },
  { href: '/college/leaderboard', label: 'Top Performing Colleges', icon: <Trophy size={18} /> },
]

export default function CollegeLayout({ children }: { children: React.ReactNode }) {
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
    const { data } = await supabase.from('users').select('role').eq('id', user.id).single()
    if (data?.role !== 'college') {
      router.push('/access-denied?area=college')
      return
    }
    setAuthState('college')
  }

  if (authState === 'loading') {
    return (
      <div style={{ padding: '100px 20px', textAlign: 'center', fontSize: '18px', color: 'var(--text-secondary)' }}>
        Loading...
      </div>
    )
  }

  return (
    <SideDrawer navItems={navItems} title="College Console">
      {children}
    </SideDrawer>
  )
}
