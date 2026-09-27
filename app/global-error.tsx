'use client'

import { useEffect } from 'react'

// Catches an error thrown by the ROOT LAYOUT itself (app/layout.tsx — Navbar, RootLayout) or
// by app/error.tsx's own boundary. A normal error.tsx canNOT catch this, because the layout it
// would need to render inside has already crashed — Next.js requires this special file instead,
// and it must render its own <html>/<body> since it fully replaces the root layout when
// triggered. Deliberately has no dependency on anything else in the app (no Navbar, no
// globals.css import) so it can never itself be taken down by whatever just crashed.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('[global error boundary] uncaught error in the root layout:', error)
  }, [error])

  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: 'system-ui, -apple-system, sans-serif', background: '#F8F9FF', minHeight: '100vh' }}>
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 16px' }}>
          <div
            style={{
              width: '100%',
              maxWidth: '480px',
              padding: '40px 32px',
              textAlign: 'center',
              background: 'rgba(255,255,255,0.9)',
              borderRadius: '20px',
              boxShadow: '0 8px 32px -8px rgba(108,71,255,0.15)',
            }}
          >
            <div style={{ fontSize: '40px', marginBottom: '12px' }}>⚠️</div>
            <h2 style={{ fontSize: '24px', marginBottom: '12px', color: '#0A0E1A' }}>Something went wrong</h2>
            <p style={{ color: '#334155', marginBottom: '24px', lineHeight: 1.6 }}>
              The page ran into an unexpected error and couldn&apos;t load. Reloading usually fixes it.
            </p>
            <button
              onClick={() => reset()}
              style={{
                padding: '12px 28px',
                borderRadius: '10px',
                border: 'none',
                background: '#6C47FF',
                color: '#fff',
                fontWeight: 600,
                fontSize: '15px',
                cursor: 'pointer',
              }}
            >
              Reload
            </button>
          </div>
        </div>
      </body>
    </html>
  )
}
