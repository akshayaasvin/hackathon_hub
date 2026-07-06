'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
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
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { RoleLoginGate } from '@/components/auth/RoleLoginGate'

type AuthState = 'loading' | 'unauthenticated' | 'admin'

export default function AdminLayout({
  children
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
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

  const navItems = [
    { href: '/admin', label: 'Dashboard', icon: <LayoutDashboard size={18} /> },
    { href: '/admin/approvals', label: 'Account Approvals', icon: <CheckSquare size={18} /> },
    { href: '/admin/applications', label: 'Applications', icon: <FileSpreadsheet size={18} /> },
    { href: '/admin/submissions', label: 'Submissions', icon: <Send size={18} /> },
    { href: '/admin/announcements', label: 'Announcements', icon: <Megaphone size={18} /> },
    { href: '/admin/results', label: 'Results', icon: <Trophy size={18} /> },
    { href: '/admin/certificates', label: 'Certificates', icon: <Award size={18} /> },
    { href: '/admin/colleges', label: 'Colleges', icon: <School size={18} /> },
    { href: '/admin/jury', label: 'Jury Management', icon: <Gavel size={18} /> },
    { href: '/admin/users', label: 'User Management', icon: <Users size={18} /> },
  ]

  return (
    <div className="admin-layout-container" style={{ display: 'flex', minHeight: 'calc(100vh - 64px)' }}>
      {/* Sidebar Navigation */}
      <aside className="admin-sidebar" style={{
        width: '260px',
        background: 'rgba(255, 255, 255, 0.6)',
        backdropFilter: 'blur(10px)',
        borderRight: '1px solid rgba(2, 132, 199, 0.1)',
        padding: '24px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        flexShrink: 0
      }}>
        <div className="admin-sidebar-header" style={{
          padding: '0 12px 16px 12px',
          borderBottom: '1px solid rgba(0, 0, 0, 0.05)',
          marginBottom: '16px'
        }}>
          <h3 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Admin Console
          </h3>
        </div>

        <div className="admin-sidebar-links" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {navItems.map((item) => {
            const isActive = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '10px 14px',
                  borderRadius: '10px',
                  textDecoration: 'none',
                  fontSize: '14px',
                  fontWeight: isActive ? 600 : 500,
                  color: isActive ? '#0369a1' : 'var(--text-secondary)',
                  background: isActive ? 'rgba(2, 132, 199, 0.08)' : 'transparent',
                  transition: 'all 0.2s ease',
                  border: isActive ? '1px solid rgba(2, 132, 199, 0.15)' : '1px solid transparent'
                }}
              >
                <span style={{ color: isActive ? 'var(--primary)' : 'var(--text-muted)' }}>
                  {item.icon}
                </span>
                {item.label}
              </Link>
            )
          })}
        </div>
      </aside>

      {/* Main Content Area */}
      <main style={{ flexGrow: 1, overflowX: 'hidden' }}>
        {children}
      </main>
    </div>
  )
}
