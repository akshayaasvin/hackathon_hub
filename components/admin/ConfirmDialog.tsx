'use client'

/**
 * A real confirmation dialog — `window.confirm` is globally overridden in app/layout.tsx to
 * always return true without ever prompting (it just logs and auto-confirms), so it cannot
 * be used for any destructive action that actually needs the admin to stop and read a count
 * or a list of names first. This component is the one place that gate lives.
 */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  danger,
  loading,
  onConfirm,
  onCancel,
}: {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  danger?: boolean
  loading?: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  if (!open) return null

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="glass-card fade-in" style={{ maxWidth: '480px', width: '100%', padding: '28px' }}>
        <h3 style={{ fontSize: '18px', marginBottom: '12px', color: 'var(--text-primary)' }}>{title}</h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px', whiteSpace: 'pre-line', lineHeight: 1.6 }}>{message}</p>
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '24px' }}>
          <button onClick={onCancel} disabled={loading} className="btn btn-secondary" style={{ padding: '10px 18px' }}>
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={danger ? 'btn btn-danger' : 'btn btn-primary'}
            style={{ padding: '10px 18px' }}
          >
            {loading ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
