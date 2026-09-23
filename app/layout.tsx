'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import { Menu, X } from 'lucide-react'
import { createClient, signOutAndRedirect } from '@/lib/supabase/client'
import NotificationBell from '@/components/NotificationBell'
import WhatsAppButton from '@/components/WhatsAppButton'
import { Toaster, toast } from 'sonner'
import './globals.css'

function Navbar() {
  const pathname = usePathname()
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false)
  const [isMobileOpen, setIsMobileOpen] = useState(false)
  const supabase = createClient()

  // Close the mobile drawer on every route change, so it never stays open over the next page.
  useEffect(() => {
    setIsMobileOpen(false)
  }, [pathname])

  useEffect(() => {
    // A one-time getUser() on mount used to be the only check here, so the
    // header never updated after a client-side navigation (LoginForm's
    // router.push has no reason to remount the root layout, and logout's
    // full reload is a separate code path) — it just kept showing whatever
    // was true when this component first mounted. onAuthStateChange fires
    // on every real transition (SIGNED_IN, SIGNED_OUT, token refresh,
    // another tab signing out), so the header now always reflects the
    // actual session instead of a stale snapshot from first paint.
    const syncAuthState = async (user: { id: string; email?: string; user_metadata?: any } | null) => {
      setIsLoggedIn(!!user)
      if (!user) return

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

    supabase.auth.getUser().then(({ data: { user } }) => syncAuthState(user))

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      syncAuthState(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
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
      {/* Wraps the bell + both action groups as ONE flex item, so .navbar-container's
          justify-content:space-between still only ever sees two sides (logo, everything
          else) — adding the bell as a third top-level child here would otherwise get
          pushed into the middle of the header instead of sitting next to the actions. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {/* Rendered exactly ONCE regardless of screen width — critical. NotificationBell opens
            its own Supabase Realtime channel named 'notifications' in a useEffect; mounting it
            a second time (one copy for desktop, one for mobile, each only hidden by CSS
            display:none but both still mounted and both subscribing) made the second instance
            call .channel('notifications').on(...) on a channel the first had already
            .subscribe()-ed, which Supabase's client throws on — crashing the whole app for
            every signed-in visitor, not just on mobile. */}
        {isLoggedIn && <NotificationBell />}

      {/* Desktop: everything inline. Hidden ≤768px (see globals.css) in favor of the
          hamburger + drawer below — this is what was previously missing on mobile,
          causing Internships/Webinars/auth buttons to overflow the header. */}
      <div className="navbar-actions">
        <Link
          href="/internship"
          className="navbar-plain-link"
          style={{ fontWeight: pathname.startsWith('/internship') ? 700 : 500, color: pathname.startsWith('/internship') ? 'var(--primary)' : undefined }}
        >
          Internships
        </Link>
        <Link
          href="/webinar"
          className={`navbar-webinar-link ${pathname === '/webinar' ? 'active' : ''}`}
        >
          <span className="live-dot" aria-hidden="true" />
          Webinars
        </Link>
        {isLoggedIn ? (
          <button
            onClick={() => signOutAndRedirect('/')}
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

      {/* Mobile only: the hamburger toggle itself (NotificationBell is now rendered once,
          above, outside this group, so it shows on both layouts without duplicating it). */}
      <div className="navbar-mobile-actions">
        <button
          className="hamburger-btn"
          onClick={() => setIsMobileOpen((v) => !v)}
          aria-label={isMobileOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={isMobileOpen}
        >
          {isMobileOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>
      </div>

      {/* Inline styles here are deliberate, on top of the .mobile-drawer-overlay/.mobile-drawer
          classes already in globals.css: they guarantee the overlay sits above the page
          content and the panel renders as a solid, right-aligned card even if anything about
          the external stylesheet's cascade/load order ever changes — this must never again
          render as bare, unstyled text over the page. */}
      {isMobileOpen && (
        <div
          className="mobile-drawer-overlay"
          onClick={() => setIsMobileOpen(false)}
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 2000,
            background: 'rgba(10,14,26,0.45)', display: 'flex', justifyContent: 'flex-end',
          }}
        >
          <div
            className="mobile-drawer"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '260px', maxWidth: '80vw', height: '100%', background: '#ffffff',
              borderLeft: '1px solid var(--border-color)', padding: '80px 16px 24px',
              display: 'flex', flexDirection: 'column', gap: '4px',
              boxShadow: '-8px 0 24px rgba(108,71,255,0.12)',
            }}
          >
            <Link href="/internship" className={`mobile-drawer-link ${pathname.startsWith('/internship') ? 'active' : ''}`}>
              Internships
            </Link>
            <Link href="/webinar" className={`mobile-drawer-link ${pathname === '/webinar' ? 'active' : ''}`} style={{ display: 'flex', alignItems: 'center' }}>
              <span className="live-dot" aria-hidden="true" style={{ marginRight: '8px' }} />
              Webinars
            </Link>
            <div style={{ height: '1px', background: 'var(--border-color)', margin: '8px 0' }} />
            {isLoggedIn ? (
              <button
                onClick={() => {
                  setIsMobileOpen(false)
                  signOutAndRedirect('/')
                }}
                className="mobile-drawer-link"
                style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', fontFamily: 'inherit', fontSize: '14px' }}
              >
                Logout
              </button>
            ) : (
              <>
                <Link href="/register" className="mobile-drawer-link">
                  Register
                </Link>
                <Link href="/login" className="mobile-drawer-link active">
                  Login
                </Link>
              </>
            )}
          </div>
        </div>
      )}
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
        <WhatsAppButton />
        <Toaster position="top-right" richColors />
      </body>
    </html>
  )
}