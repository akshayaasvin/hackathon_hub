export type RegistrationStatusValue =
  | 'not_registered'
  | 'registered'
  | 'payment_pending'
  | 'payment_submitted'
  | 'approved'
  | 'rejected'
  | 'team_created'
  | 'submitted'

const STATUS_CONFIG: Record<RegistrationStatusValue, { label: string; bg: string; text: string }> = {
  not_registered: { label: 'Not Registered', bg: 'rgba(107, 114, 128, 0.15)', text: '#6b7280' },
  registered: { label: 'Registered', bg: 'rgba(107, 114, 128, 0.15)', text: '#6b7280' },
  payment_pending: { label: 'Payment Pending', bg: 'rgba(245, 158, 11, 0.15)', text: '#b45309' },
  payment_submitted: { label: 'Payment Under Review', bg: 'rgba(245, 158, 11, 0.15)', text: '#b45309' },
  approved: { label: 'Approved', bg: 'rgba(16, 185, 129, 0.15)', text: 'var(--success)' },
  rejected: { label: 'Payment Rejected', bg: 'rgba(239, 68, 68, 0.15)', text: 'var(--danger)' },
  team_created: { label: 'Team Created', bg: 'rgba(16, 185, 129, 0.15)', text: 'var(--success)' },
  submitted: { label: 'Submitted', bg: 'rgba(59, 130, 246, 0.15)', text: '#2563eb' },
}

export function RegistrationStatusChip({ status }: { status: RegistrationStatusValue }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.not_registered
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '4px 12px',
        borderRadius: '20px',
        fontSize: '12px',
        fontWeight: 600,
        background: config.bg,
        color: config.text,
        whiteSpace: 'nowrap',
      }}
    >
      {config.label}
    </span>
  )
}
