'use client'

export function FormField({
  label,
  error,
  children,
}: {
  label: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <div style={{ marginBottom: '16px' }}>
      <label
        style={{
          display: 'block',
          marginBottom: '6px',
          fontSize: '13px',
          fontWeight: 600,
          color: 'var(--text-secondary)',
        }}
      >
        {label}
      </label>
      {children}
      {error && (
        <div style={{ color: 'var(--danger)', fontSize: '12px', marginTop: '4px' }}>{error}</div>
      )}
    </div>
  )
}
