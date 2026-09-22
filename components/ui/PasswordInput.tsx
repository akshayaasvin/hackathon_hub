'use client'

import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'

/**
 * A `.premium-input` password field with a show/hide eye button, used everywhere a password
 * is entered (login, admin/jury login, registration, confirm password). Hidden by default;
 * this only ever toggles the input's own `type` client-side — nothing about how the password
 * is submitted, stored or hashed changes (still plain HTTPS POST to Supabase Auth, which
 * hashes it server-side; the browser never writes it anywhere else).
 */
export function PasswordInput({
  id,
  value,
  onChange,
  placeholder,
  required,
  autoComplete,
  minLength,
}: {
  id?: string
  value: string
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  placeholder?: string
  required?: boolean
  autoComplete?: string
  minLength?: number
}) {
  const [visible, setVisible] = useState(false)

  return (
    <div style={{ position: 'relative' }}>
      <input
        id={id}
        type={visible ? 'text' : 'password'}
        className="premium-input"
        style={{ paddingRight: '44px' }}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        autoComplete={autoComplete}
        minLength={minLength}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Hide password' : 'Show password'}
        aria-pressed={visible}
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          bottom: 0,
          width: '44px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--text-muted)',
          padding: 0,
        }}
      >
        {visible ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </div>
  )
}
