'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Menu, X } from 'lucide-react'

export interface SideDrawerNavItem {
  href: string
  label: string
  icon: React.ReactNode
}

// Shared persistent sidebar for all 4 role dashboards. Desktop: pinned left
// column, brand at top. Mobile: off-canvas slide-in drawer, opened via the
// hamburger in the slim mobile bar above the page content (see the
// .dashboard-* / .admin-sidebar rules in globals.css).
export function SideDrawer({
  navItems,
  title,
  children,
}: {
  navItems: SideDrawerNavItem[]
  title: string
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const [isMobileOpen, setIsMobileOpen] = useState(false)

  // Close the drawer whenever the route changes so it doesn't stay open
  // over the next page after a nav click.
  useEffect(() => {
    setIsMobileOpen(false)
  }, [pathname])

  return (
    <div className="admin-layout-container" style={{ display: 'flex', minHeight: 'calc(100vh - 64px)', position: 'relative' }}>
      <div className="dashboard-mobile-bar">
        <button onClick={() => setIsMobileOpen(true)} className="dashboard-hamburger-btn" aria-label="Open menu">
          <Menu size={20} />
        </button>
        <span className="dashboard-mobile-bar-title">{title}</span>
      </div>

      {isMobileOpen && <div className="dashboard-sidebar-overlay" onClick={() => setIsMobileOpen(false)} />}

      <aside
        className={`admin-sidebar ${isMobileOpen ? 'admin-sidebar-open' : ''}`}
        style={{
          width: '260px',
          background: 'rgba(255, 255, 255, 0.6)',
          backdropFilter: 'blur(10px)',
          borderRight: '1px solid rgba(2, 132, 199, 0.1)',
          padding: '24px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          flexShrink: 0,
        }}
      >
        <div className="admin-sidebar-brand" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 12px 20px 12px' }}>
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none' }}>
            <svg width="26" height="26" viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
              <path d="M22 3L39 12.5V31.5L22 41L5 31.5V12.5L22 3Z" fill="white" stroke="#6C47FF" strokeWidth="1.5"/>
              <path d="M25 8L14 24H21L19 36L30 20H23L25 8Z" fill="#6C47FF"/>
              <circle cx="35" cy="9" r="4.5" fill="#00C47A"/>
            </svg>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: '16px', fontWeight: 800, letterSpacing: '-0.02em' }}>
              <span style={{ color: 'var(--primary)' }}>Hackathon</span><span style={{ color: 'var(--text-primary)' }}>Hub</span>
            </span>
          </Link>
          <button onClick={() => setIsMobileOpen(false)} className="dashboard-sidebar-close-btn" aria-label="Close menu">
            <X size={20} />
          </button>
        </div>

        <div
          className="admin-sidebar-header"
          style={{ padding: '0 12px 16px 12px', borderBottom: '1px solid rgba(0, 0, 0, 0.05)', marginBottom: '16px' }}
        >
          <h3 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {title}
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
                  border: isActive ? '1px solid rgba(2, 132, 199, 0.15)' : '1px solid transparent',
                }}
              >
                <span style={{ color: isActive ? 'var(--primary)' : 'var(--text-muted)' }}>{item.icon}</span>
                {item.label}
              </Link>
            )
          })}
        </div>
      </aside>

      <main style={{ flexGrow: 1, overflowX: 'hidden' }}>{children}</main>
    </div>
  )
}
