'use client'

import { useRouter } from 'next/navigation'
import { Sliders } from 'lucide-react'

export default function ScoringLandingPage() {
  const router = useRouter()

  return (
    <div className="premium-container fade-in" style={{ maxWidth: '600px', marginTop: '60px' }}>
      <div className="glass-card" style={{ textAlign: 'center', padding: '60px 40px' }}>
        <Sliders size={32} color="var(--primary)" style={{ marginBottom: '16px' }} />
        <h2 style={{ fontSize: '20px', marginBottom: '8px' }}>Pick a team to score</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>
          Scoring happens per team — open a hackathon's Assigned Submissions list and click
          "Score Project" or "Edit Scorecard" on the team you want to evaluate.
        </p>
        <button onClick={() => router.push('/jury')} className="btn btn-primary" style={{ padding: '10px 24px' }}>
          Go to Dashboard
        </button>
      </div>
    </div>
  )
}
