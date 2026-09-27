'use client'

import { useEffect } from 'react'

// Root error boundary (Next.js App Router convention: this file automatically wraps every
// route under the root layout). Without this, an uncaught error anywhere in a page's render —
// a bad date, a null field, anything — unmounts the whole React tree and leaves a permanently
// blank page with nothing in the DOM to recover from, which is exactly what was reported.
// This does NOT catch errors thrown by the root layout itself (Navbar, RootLayout) — see
// app/global-error.tsx for that.
export default function GlobalPageError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('[error boundary] uncaught error rendering a page:', error)
  }, [error])

  return (
    <div style={{ minHeight: 'calc(100vh - 64px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 16px' }}>
      <div className="glass-card fade-in" style={{ width: '100%', maxWidth: '480px', padding: '40px 32px', textAlign: 'center' }}>
        <div style={{ fontSize: '40px', marginBottom: '12px' }}>⚠️</div>
        <h2 style={{ fontSize: '26px', marginBottom: '12px', fontFamily: 'var(--font-display)' }}>Something went wrong</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', lineHeight: 1.6 }}>
          This page ran into an unexpected error. Reloading usually fixes it — if it keeps happening, please let us know.
        </p>
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <button onClick={() => reset()} className="btn btn-primary" style={{ padding: '12px 28px' }}>
            Try Again
          </button>
          <button onClick={() => { window.location.href = '/' }} className="btn btn-secondary" style={{ padding: '12px 28px' }}>
            Go Home
          </button>
        </div>
      </div>
    </div>
  )
}
