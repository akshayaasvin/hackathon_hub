'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  LayoutDashboard,
  CheckSquare,
  FileSpreadsheet,
  Send,
  Megaphone,
  Trophy,
  Award,
  School,
  Gavel,
  Users,
  ShieldCheck,
  CreditCard,
  Building2,
  Wallet,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { RoleLoginGate } from '@/components/auth/RoleLoginGate'
import { SideDrawer } from '@/components/dashboard/SideDrawer'

type AuthState = 'loading' | 'unauthenticated' | 'admin'

const navItems = [
  { href: '/admin', label: 'Dashboard', icon: <LayoutDashboard size={18} /> },
  { href: '/admin/approvals', label: 'Account Approvals', icon: <CheckSquare size={18} /> },
  { href: '/admin/registrations', label: 'Payment Approvals', icon: <CreditCard size={18} /> },
  { href: '/admin/applications', label: 'Applications', icon: <FileSpreadsheet size={18} /> },
  { href: '/admin/submissions', label: 'Submissions', icon: <Send size={18} /> },
  { href: '/admin/announcements', label: 'Announcements', icon: <Megaphone size={18} /> },
  { href: '/admin/results', label: 'Results', icon: <Trophy size={18} /> },
  { href: '/admin/certificates', label: 'Certificates', icon: <Award size={18} /> },
  { href: '/admin/colleges', label: 'Colleges', icon: <School size={18} /> },
  { href: '/admin/institutions', label: 'Institutions', icon: <Building2 size={18} /> },
  { href: '/admin/college-ledger', label: 'College Ledger', icon: <Wallet size={18} /> },
  { href: '/admin/jury', label: 'Jury Management', icon: <Gavel size={18} /> },
  { href: '/admin/users', label: 'User Management', icon: <Users size={18} /> },
]

export default function AdminLayout({
  children
}: {
  children: React.ReactNode
}) {
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
    if (data?.role !== 'admin') {
      // Middleware already redirects this case server-side on a fresh request;
      // this only fires for a client-side transition that didn't re-hit it.
      router.push('/access-denied?area=admin')
      return
    }
    setAuthState('admin')
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
        icon={<ShieldCheck size={36} />}
        title="Admin Sign In"
        subtitle="Restricted area — administrator credentials required."
        accentColor="#0F172A"
        onAuthenticated={checkAuth}
      />
    )
  }

  return (
    <SideDrawer navItems={navItems} title="Admin Console">
      {children}
    </SideDrawer>
  )
}
