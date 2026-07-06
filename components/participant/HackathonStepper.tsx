import { Check } from 'lucide-react'
import type { RegistrationStatusValue } from './RegistrationStatusChip'

const STAGES = ['Register', 'Pay', 'Approval', 'Team', 'Submit'] as const

// Maps every registration status onto a 0-4 index into STAGES (which stage
// is "current"). rejected sits back at the Pay stage since the participant
// needs to retry payment.
function stageIndex(status: RegistrationStatusValue): number {
  switch (status) {
    case 'not_registered':
      return -1
    case 'registered':
      return 0
    case 'payment_pending':
    case 'payment_submitted':
    case 'rejected':
      return 1
    case 'approved':
      return 2
    case 'team_created':
      return 3
    case 'submitted':
      return 4
    default:
      return 0
  }
}

export function HackathonStepper({ status }: { status: RegistrationStatusValue }) {
  const current = stageIndex(status)

  return (
    <div style={{ display: 'flex', alignItems: 'center', width: '100%', marginBottom: '8px' }}>
      {STAGES.map((stage, i) => {
        const isDone = i < current || status === 'submitted' && i <= current
        const isCurrent = i === current
        const isRejectedHere = status === 'rejected' && i === 1

        return (
          <div key={stage} style={{ display: 'flex', alignItems: 'center', flex: i < STAGES.length - 1 ? 1 : 'none' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '13px',
                  fontWeight: 700,
                  flexShrink: 0,
                  background: isRejectedHere
                    ? 'var(--danger)'
                    : isDone
                    ? 'var(--success)'
                    : isCurrent
                    ? 'var(--primary)'
                    : 'rgba(107, 114, 128, 0.15)',
                  color: isDone || isCurrent || isRejectedHere ? '#fff' : '#6b7280',
                  border: isCurrent ? '3px solid rgba(99, 102, 241, 0.25)' : 'none',
                }}
              >
                {isDone ? <Check size={16} /> : i + 1}
              </div>
              <span
                style={{
                  fontSize: '12px',
                  fontWeight: isCurrent ? 700 : 500,
                  color: isCurrent ? 'var(--text-primary)' : 'var(--text-secondary)',
                  whiteSpace: 'nowrap',
                }}
              >
                {stage}
              </span>
            </div>
            {i < STAGES.length - 1 && (
              <div
                style={{
                  flex: 1,
                  height: '2px',
                  margin: '0 8px',
                  marginBottom: '20px',
                  background: i < current ? 'var(--success)' : 'rgba(107, 114, 128, 0.15)',
                }}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
