'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export interface SideDrawerNavItem {
  href: string
  label: string
  icon: React.ReactNode
}

// Shared persistent sidebar for all 4 role dashboards. Desktop: pinned left
// column. Mobile: collapses to a horizontal scrollable tab strip (see the
// .admin-sidebar rules in globals.css — already mobile-safe from an earlier
// fix, reused here under its original class names since they're purely
// presentational, not admin-specific).
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

  return (
    <div className="admin-layout-container" style={{ display: 'flex', minHeight: 'calc(100vh - 64px)' }}>
      <aside
        className="admin-sidebar"
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
