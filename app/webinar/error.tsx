'use client'

import { useEffect } from 'react'
import Link from 'next/link'

// Route-level boundary for the webinar flow, mirroring app/internship/error.tsx.
export default function WebinarError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('[webinar error boundary] uncaught error:', error)
  }, [error])

  return (
    <div className="premium-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
      <div className="glass-card fade-in" style={{ width: '100%', maxWidth: '480px', padding: '40px 32px', textAlign: 'center', borderLeft: '4px solid var(--danger)' }}>
        <h3 style={{ marginBottom: '8px' }}>We couldn&apos;t load this page</h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '20px' }}>
          Something went wrong. Please try again — if it keeps happening, contact support.
        </p>
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <button onClick={() => reset()} className="btn btn-primary" style={{ padding: '10px 24px' }}>Try Again</button>
          <Link href="/" className="btn btn-secondary" style={{ padding: '10px 24px' }}>Go Home</Link>
        </div>
      </div>
    </div>
  )
}
