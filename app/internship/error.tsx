'use client'

import { useEffect } from 'react'
import Link from 'next/link'

// Route-level boundary for the internship flow specifically (list, detail, status) — more
// specific than app/error.tsx, so a crash in one internship card or one registration flow
// doesn't have to fall all the way back to the generic page-level message.
export default function InternshipError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('[internship error boundary] uncaught error:', error)
  }, [error])

  return (
    <div className="premium-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
      <div className="glass-card fade-in" style={{ width: '100%', maxWidth: '480px', padding: '40px 32px', textAlign: 'center', borderLeft: '4px solid var(--danger)' }}>
        <h3 style={{ marginBottom: '8px' }}>We couldn&apos;t load this internship</h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '20px' }}>
          Something went wrong. Please try again — if it keeps happening, contact support.
        </p>
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <button onClick={() => reset()} className="btn btn-primary" style={{ padding: '10px 24px' }}>Try Again</button>
          <Link href="/internship" className="btn btn-secondary" style={{ padding: '10px 24px' }}>Browse Internships</Link>
        </div>
      </div>
    </div>
  )
}
