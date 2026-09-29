'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import type { RegistrationStatusValue } from './RegistrationStatusChip'
import type { RoundProgress } from './HackathonStepper'

/**
 * Current step (1-7) given the registration status and round progress — used only to
 * highlight where the participant is in the list below. registration.status alone stops
 * distinguishing once a team exists ('team_created' covers everything from "just formed a
 * team" through "submitted Round 2"), so round-specific state fills in the rest, same as
 * HackathonStepper.
 */
function computeCurrentStep(status: RegistrationStatusValue, round?: RoundProgress): number {
  switch (status) {
    case 'not_registered':
    case 'registered':
    case 'payment_pending':
    case 'payment_submitted':
    case 'rejected':
      return 1
    case 'approved':
      return 3
    case 'team_created':
    case 'submitted': {
      if (!round) return 3
      if (round.finalPublished) return 7
      if (round.round2Submitted) return 6
      if (round.shortlisted === true) return 6
      if (round.shortlisted === false) return 5
      if (round.round1Submitted) return 5
      return 4
    }
    default:
      return 1
  }
}

const dateLabel = (iso: string | null | undefined) => {
  if (!iso) return null
  return new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function HackathonInstructions({
  hackathon,
  status,
  round,
}: {
  hackathon: any
  status: RegistrationStatusValue
  round?: RoundProgress
}) {
  const [open, setOpen] = useState(true)
  const currentStep = computeCurrentStep(status, round)
  const round1Deadline = dateLabel(hackathon?.round1_deadline)
  const round2Deadline = dateLabel(hackathon?.round2_deadline)

  const steps: string[] = [
    'Register and pay the fee.',
    'Wait for admin approval.',
    'After approval, choose: Team Leader (create team + invite members by registered email), Team Member (wait for your leader’s invite — it appears on your Dashboard), or Solo.',
    `Round 1: leader submits the presentation link (Google Drive/Slides, "anyone with the link can view")${round1Deadline ? ` before ${round1Deadline}` : ''}. You'll get an email with the Google Meet link, date and time to pitch.`,
    'Shortlisted teams are announced after the pitch.',
    `Round 2 (shortlisted only): submit GitHub link, live demo link and optional demo video${round2Deadline ? ` before ${round2Deadline}` : ''}.`,
    'Winners are announced on the Results page. Certificates appear under Certificates.',
  ]

  return (
    <div className="glass-card" style={{ marginBottom: '24px' }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%',
          background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit',
        }}
      >
        <h3 style={{ fontSize: '16px' }}>How this hackathon works</h3>
        {open ? <ChevronUp size={18} color="var(--text-secondary)" /> : <ChevronDown size={18} color="var(--text-secondary)" />}
      </button>

      {open && (
        <div style={{ marginTop: '16px', display: 'grid', gap: '4px' }}>
          {steps.map((text, i) => {
            const stepNum = i + 1
            const isCurrent = stepNum === currentStep
            const isDone = stepNum < currentStep
            return (
              <div
                key={stepNum}
                style={{
                  display: 'flex', gap: '12px', alignItems: 'flex-start', padding: '10px 12px', borderRadius: '8px',
                  background: isCurrent ? 'rgba(108,71,255,0.06)' : 'transparent',
                  border: isCurrent ? '1px solid var(--border-hover)' : '1px solid transparent',
                }}
              >
                <span
                  style={{
                    flexShrink: 0, width: '24px', height: '24px', borderRadius: '50%', display: 'flex',
                    alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700,
                    background: isCurrent ? 'var(--primary)' : isDone ? 'var(--success)' : 'rgba(107,114,128,0.15)',
                    color: isCurrent || isDone ? '#fff' : '#6b7280',
                  }}
                >
                  {stepNum}
                </span>
                <span style={{ fontSize: '13px', lineHeight: 1.6, color: isCurrent ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: isCurrent ? 600 : 400 }}>
                  {text}
                </span>
              </div>
            )
          })}
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px' }}>
            Max team size for this hackathon: {hackathon?.max_team_size ?? '—'}.
          </p>
        </div>
      )}
    </div>
  )
}
