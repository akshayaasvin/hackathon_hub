'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import NotificationBell from '@/components/NotificationBell'
import { Toaster, toast } from 'sonner'
import './globals.css'

function Navbar() {
  const pathname = usePathname()
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false)
  const supabase = createClient()

  useEffect(() => {
    const getAuthState = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setIsLoggedIn(true)

        const { data: userData, error } = await supabase
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
          await supabase.from('users').insert(newProfile).select().single()
        }
      }
    }
    getAuthState()
  }, [])

  return (
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
      <div className="navbar-actions">
        {isLoggedIn ? (
          <>
            <NotificationBell />
            <button
              onClick={async () => {
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
          </>
        ) : (
          <>
            <Link href="/register" className="btn btn-secondary" style={{ padding: '6px 14px', fontSize: '13px' }}>
              Register
            </Link>
            <Link href="/login" className="btn btn-primary" style={{ padding: '6px 14px', fontSize: '13px' }}>
              Login
            </Link>
          </>
        )}
      </div>
    </nav>
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