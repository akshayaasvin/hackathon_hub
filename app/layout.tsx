'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import NotificationBell from '@/components/NotificationBell'
import { Toaster, toast } from 'sonner'
import { Menu, X } from 'lucide-react'
import './globals.css'

function Navbar() {
  const pathname = usePathname()
  const [userRole, setUserRole] = useState<string>('participant')
  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false)
  const supabase = createClient()

  useEffect(() => {
    const getUserRole = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        let { data: userData, error } = await supabase
          .from('users')
          .select('role')
          .eq('id', user.id)
          .single()
        
        if (error || !userData) {
          const newProfile = {
            id: user.id,
            email: user.email,
            full_name: user.user_metadata?.full_name || 'Participant',
            role: user.user_metadata?.role || 'participant',
            created_at: new Date().toISOString()
          }
          const { data: insertedData, error: insertError } = await supabase
            .from('users')
            .insert(newProfile)
            .select()
            .single()
          
          if (!insertError && insertedData) {
            setUserRole(insertedData.role)
          } else {
            setUserRole(user.user_metadata?.role || 'participant')
          }
        } else {
          setUserRole(userData.role || 'participant')
        }
      }
    }
    getUserRole()
  }, [])

  // Close mobile drawer when path changes
  useEffect(() => {
    setIsMenuOpen(false)
  }, [pathname])

  const getLinks = () => {
    const baseLinks = [
      { href: '/participant', label: 'Participant' },
      { href: '/results', label: 'Results' },
      { href: '/certificates', label: 'Certificates' },
      { href: '/profile', label: 'Profile' },
    ]
    
    if (userRole === 'admin') {
      return [
        { href: '/admin', label: 'Admin' },
        { href: '/admin/approvals', label: 'Approvals' },
        { href: '/admin/announcements', label: 'Announcements' },
        ...baseLinks,
      ]
    }
    
    if (userRole === 'jury') {
      return [{ href: '/jury', label: 'Jury' }, ...baseLinks]
    }
    
    if (userRole === 'college') {
      return [{ href: '/college', label: 'College' }, ...baseLinks]
    }
    
    return baseLinks
  }

  const links = getLinks()

  return (
    <>
      <nav className={`navbar-container ${pathname === '/' ? 'navbar-landing-bright' : ''}`}>
        <Link href="/" className="navbar-logo-link">
          {/* HackathonHub SVG Logo */}
          <svg width="32" height="32" viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
            <path d="M22 3L39 12.5V31.5L22 41L5 31.5V12.5L22 3Z" fill="white" stroke="#6C47FF" strokeWidth="1.5"/>
            <path d="M25 8L14 24H21L19 36L30 20H23L25 8Z" fill="#6C47FF"/>
            <circle cx="35" cy="9" r="4.5" fill="#00C47A"/>
          </svg>
          <span className="navbar-logo-wordmark">
            <span className="wm-hack">Hackathon</span><span className="wm-hub">Hub</span>
          </span>
        </Link>
        <div className="navbar-desktop-links">
          {links.map((link) => (
            <Link 
              key={link.href} 
              href={link.href}
              className={`navbar-desktop-link ${pathname === link.href ? 'active' : ''}`}
            >
              {link.label}
            </Link>
          ))}
        </div>
        <div className="navbar-actions">
          <NotificationBell />
          <button
            onClick={async () => {
              const supabase = createClient()
              await supabase.auth.signOut()
              window.location.href = '/'
            }}
            className="btn"
            style={{ 
              padding: '6px 12px', 
              fontSize: '13px',
              borderColor: 'var(--danger-border)',
              color: 'var(--danger)',
              background: 'var(--danger-bg)',
              fontWeight: 600
            }}
          >
            Logout
          </button>
          <button 
            onClick={() => setIsMenuOpen(!isMenuOpen)} 
            className="hamburger-btn"
            aria-label="Toggle Menu"
          >
            {isMenuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </nav>

      {/* Mobile Drawer */}
      {isMenuOpen && (
        <div className={`mobile-drawer-overlay ${pathname === '/' ? 'mobile-drawer-overlay-landing-bright' : ''}`} onClick={() => setIsMenuOpen(false)}>
          <div className={`mobile-drawer ${pathname === '/' ? 'mobile-drawer-landing-bright' : ''}`} onClick={(e) => e.stopPropagation()}>
            {links.map((link) => (
              <Link 
                key={link.href} 
                href={link.href}
                className={`mobile-drawer-link ${pathname === link.href ? 'active' : ''}`}
                onClick={() => setIsMenuOpen(false)}
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </>
  )
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.alert = (msg) => {
        toast(msg)
        console.log('WINDOW.ALERT:', msg)
      }
      window.confirm = (msg) => {
        console.log('WINDOW.CONFIRM (auto-confirmed):', msg)
        return true
      }
      window.prompt = (msg, defaultVal) => {
        console.log('WINDOW.PROMPT:', msg, defaultVal)
        return defaultVal || ''
      }
    }
  }, [])

  return (
    <html lang="en">
      <body className={pathname === '/' ? 'body-landing-light' : ''}>
        <Navbar />
        <main>{children}</main>
        <Toaster position="top-right" richColors />
      </body>
    </html>
  )
}