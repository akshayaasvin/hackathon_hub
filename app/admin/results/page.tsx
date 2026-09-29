'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Trophy } from 'lucide-react'

// Hackathon picker for the consolidated Results flow — "View Standings" now opens
// /admin/results/[hackathonId] (Round 1 Shortlist / Round 2 Demo Meeting / Winners tabs)
// instead of the old evaluations-only declare-winners flow that used to live on this page.
export default function AdminResultsPickerPage() {
  const [hackathons, setHackathons] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    ;(async () => {
      const { data } = await supabase.from('hackathons').select('*').is('deleted_at', null).order('created_at', { ascending: false })
      setHackathons(data || [])
      setLoading(false)
    })()
  }, [])

  if (loading) {
    return <div style={{ padding: '100px 20px', textAlign: 'center', fontSize: '18px', color: 'var(--text-secondary)' }}>Loading…</div>
  }

  return (
    <div className="premium-container fade-in">
      <div style={{ marginBottom: '40px' }}>
        <h1 style={{ fontSize: '32px', marginBottom: '8px', fontFamily: 'var(--font-display)' }}>🏆 Results &amp; Standings</h1>
        <p style={{ color: 'var(--text-secondary)' }}>Pitch scheduling, Round 1/2 shortlisting, and winners — one flow per hackathon.</p>
      </div>

      <h2 style={{ fontSize: '20px', marginBottom: '20px', fontFamily: 'var(--font-display)' }}>Select Hackathon</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {hackathons.length === 0 ? (
          <div className="glass-card" style={{ textAlign: 'center', padding: '60px 40px', color: 'var(--text-secondary)' }}>
            No hackathons yet.
          </div>
        ) : (
          hackathons.map((hackathon) => (
            <div key={hackathon.id} className="glass-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px' }}>
              <div>
                <h3 style={{ fontSize: '18px', color: 'var(--text-primary)', marginBottom: '6px' }}>{hackathon.name}</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>{hackathon.description || 'No description provided'}</p>
              </div>
              <button
                onClick={() => router.push(`/admin/results/${hackathon.id}`)}
                className="btn btn-primary"
                style={{ padding: '10px 24px', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
              >
                <Trophy size={16} /> View Standings
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
