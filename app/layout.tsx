'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect, useRef } from 'react'
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

  // Close the mobile menu on every route change, so it never stays open over the next page.
  useEffect(() => {
    setIsMobileOpen(false)
  }, [pathname])

  // Close the mobile menu on Escape, and stop the page from scrolling behind it while open.
  useEffect(() => {
    if (!isMobileOpen) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsMobileOpen(false)
    }
    document.addEventListener('keydown', onKeyDown)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = prevOverflow
    }
  }, [isMobileOpen])

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

  // Outside-click-to-close for the mobile menu. Attached to the whole <header> (nav row +
  // menu panel both live inside it), so a tap on the hamburger button itself — which toggles
  // isMobileOpen a moment before this fires — never immediately re-closes what it just opened.
  const headerRef = useRef<HTMLElement>(null)
  useEffect(() => {
    if (!isMobileOpen) return
    const onPointerDown = (e: MouseEvent) => {
      if (headerRef.current && !headerRef.current.contains(e.target as Node)) {
        setIsMobileOpen(false)
      }
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [isMobileOpen])

  const closeMobileMenu = () => setIsMobileOpen(false)

  return (
    <header ref={headerRef} className="site-header">
      <nav className={`navbar-container ${pathname === '/' ? 'navbar-landing-bright' : ''}`} aria-label="Main">
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

        {/* Wraps the bell + the desktop actions + the mobile hamburger as ONE flex item, so
            .navbar-container's justify-content:space-between still only ever sees two sides
            (logo, everything else) — adding the bell as a third top-level child here would
            otherwise get pushed into the middle of the header instead of sitting next to the
            actions. Desktop and mobile controls below are fully separate elements shown/hidden
            per breakpoint via CSS (.navbar-actions vs .hamburger-btn) — neither shares the
            other's layout rules, so nothing "leaks" between them. */}
        <div className="navbar-right">
          {/* Rendered exactly ONCE regardless of screen width — critical. NotificationBell opens
              its own Supabase Realtime channel named 'notifications' in a useEffect; mounting it
              a second time (one copy for desktop, one for mobile, each only hidden by CSS
              display:none but both still mounted and both subscribing) made the second instance
              call .channel('notifications').on(...) on a channel the first had already
              .subscribe()-ed, which Supabase's client throws on — crashing the whole app for
              every signed-in visitor, not just on mobile. */}
          {isLoggedIn && <NotificationBell />}

          {/* Desktop navigation: md and above. Hidden below 768px in favor of the hamburger +
              full-width menu — a completely separate block below, not a shared style. */}
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

          {/* Mobile navigation: below 768px. Just the hamburger toggle lives in the header row
              itself; the menu it opens is a sibling of <nav>, positioned below the whole
              header (see .navbar-mobile-menu), never inline with these desktop controls. */}
          <button
            type="button"
            className="hamburger-btn"
            onClick={() => setIsMobileOpen((v) => !v)}
            aria-label={isMobileOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={isMobileOpen}
            aria-controls="navbar-mobile-menu"
          >
            {isMobileOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </nav>

      {/* Mobile menu: a full-width panel directly below the header row, not a side drawer.
          Positioned absolute relative to <header> (top:100%, left/right:0) so it can never be
          mistaken for being anchored to the hero section or <body> — closes on nav-item click,
          outside click (see the effect above) and Escape (see the effect above). Desktop and
          mobile menus never render at the same time: this block only exists in the DOM while
          isMobileOpen is true, and .navbar-actions/.hamburger-btn are mutually exclusive per
          breakpoint via CSS, so there is no state where both are visible. */}
      {isMobileOpen && (
        <div id="navbar-mobile-menu" className="navbar-mobile-menu" role="menu">
          <Link
            href="/internship"
            role="menuitem"
            className={`navbar-mobile-link ${pathname.startsWith('/internship') ? 'active' : ''}`}
            onClick={closeMobileMenu}
          >
            Internships
          </Link>
          <Link
            href="/webinar"
            role="menuitem"
            className={`navbar-mobile-link ${pathname === '/webinar' ? 'active' : ''}`}
            onClick={closeMobileMenu}
          >
            <span className="live-dot" aria-hidden="true" style={{ marginRight: '8px' }} />
            Webinars
          </Link>
          {isLoggedIn ? (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                closeMobileMenu()
                signOutAndRedirect('/')
              }}
              className="navbar-mobile-link navbar-mobile-logout"
            >
              Logout
            </button>
          ) : (
            <>
              <Link href="/register" role="menuitem" className="navbar-mobile-link" onClick={closeMobileMenu}>
                Register
              </Link>
              <Link href="/login" role="menuitem" className="navbar-mobile-link active" onClick={closeMobileMenu}>
                Login
              </Link>
            </>
          )}
        </div>
      )}
    </header>
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