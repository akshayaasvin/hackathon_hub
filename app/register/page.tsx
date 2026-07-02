'use client'

import { useState } from 'react'
import { ParticipantRegisterForm } from '@/components/auth/ParticipantRegisterForm'
import { CollegeRegisterForm } from '@/components/auth/CollegeRegisterForm'
import { JuryRegisterForm } from '@/components/auth/JuryRegisterForm'

type Role = 'participant' | 'college' | 'jury'

const roleOptions: { role: Role; title: string; blurb: string }[] = [
  { role: 'participant', title: 'Student', blurb: 'Register to join a hackathon, form a team, and submit your project.' },
  { role: 'college', title: 'College', blurb: 'Register your institution to track your students and get recognized.' },
  { role: 'jury', title: 'Jury Member', blurb: 'Register to evaluate submissions and mentor teams.' },
]

const successCopy: Record<Role, { title: string; body: string }> = {
  participant: {
    title: 'Check your inbox',
    body: 'We sent a verification link to your email. Confirm it, then log in — your account activates automatically.',
  },
  college: {
    title: 'Submitted for review',
    body: "Your college's registration is with our admin team. You'll receive your login credentials by email once approved.",
  },
  jury: {
    title: 'Submitted for review',
    body: "Your registration is with our admin team. You'll receive your login credentials by email once approved.",
  },
}

export default function RegisterPage() {
  const [role, setRole] = useState<Role | null>(null)
  const [success, setSuccess] = useState<Role | null>(null)

  return (
    <div
      style={{
        minHeight: 'calc(100vh - 64px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 16px',
      }}
    >
      {success ? (
        <div className="glass-card fade-in" style={{ width: '100%', maxWidth: '440px', padding: '40px 32px', textAlign: 'center' }}>
          <h2 style={{ fontSize: '26px', marginBottom: '12px', fontFamily: 'var(--font-display)' }}>
            {successCopy[success].title}
          </h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', lineHeight: 1.6 }}>
            {successCopy[success].body}
          </p>
          <a href="/login" className="btn btn-primary" style={{ padding: '12px 28px' }}>
            Go to Login
          </a>
        </div>
      ) : role === null ? (
        <div className="glass-card fade-in" style={{ width: '100%', maxWidth: '640px', padding: '40px 32px' }}>
          <h2
            style={{
              textAlign: 'center',
              marginBottom: '8px',
              fontSize: '28px',
              color: 'var(--text-primary)',
              fontFamily: 'var(--font-display)',
            }}
          >
            I am a...
          </h2>
          <p style={{ textAlign: 'center', color: 'var(--text-muted)', marginBottom: '28px' }}>
            Choose how you'd like to join HackathonHub
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '16px' }}>
            {roleOptions.map((opt) => (
              <button
                key={opt.role}
                onClick={() => setRole(opt.role)}
                className="btn-secondary"
                style={{
                  border: '1px solid var(--border-color)',
                  borderRadius: '14px',
                  padding: '20px 16px',
                  textAlign: 'left',
                  cursor: 'pointer',
                  background: 'rgba(255,255,255,0.6)',
                }}
              >
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '16px', marginBottom: '6px' }}>
                  {opt.title}
                </div>
                <div style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.5 }}>{opt.blurb}</div>
              </button>
            ))}
          </div>
          <p style={{ textAlign: 'center', marginTop: '24px', fontSize: '14px', color: 'var(--text-secondary)' }}>
            <a href="/login" style={{ color: 'var(--primary)', textDecoration: 'none', fontWeight: 600 }}>
              Already have an account? Sign In
            </a>
          </p>
        </div>
      ) : (
        <div className="glass-card fade-in" style={{ width: '100%', maxWidth: '640px', padding: '40px 32px' }}>
          <button
            onClick={() => setRole(null)}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--primary)',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 600,
              marginBottom: '16px',
              padding: 0,
            }}
          >
            ← Change role
          </button>
          <h2
            style={{
              marginBottom: '24px',
              fontSize: '26px',
              color: 'var(--text-primary)',
              fontFamily: 'var(--font-display)',
            }}
          >
            {role === 'participant' && 'Student Registration'}
            {role === 'college' && 'College Registration'}
            {role === 'jury' && 'Jury Registration'}
          </h2>
          {role === 'participant' && <ParticipantRegisterForm onSuccess={() => setSuccess('participant')} />}
          {role === 'college' && <CollegeRegisterForm onSuccess={() => setSuccess('college')} />}
          {role === 'jury' && <JuryRegisterForm onSuccess={() => setSuccess('jury')} />}
        </div>
      )}
    </div>
  )
}
