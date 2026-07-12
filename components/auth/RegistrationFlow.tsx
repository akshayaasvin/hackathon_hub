'use client'

import { useState } from 'react'
import { ParticipantRegisterForm } from './ParticipantRegisterForm'
import { CollegeRegisterForm } from './CollegeRegisterForm'
import { JuryRegisterForm } from './JuryRegisterForm'

export type RegisterRole = 'participant' | 'college' | 'jury'

const roleMeta: Record<RegisterRole, { title: string; blurb: string; formTitle: string }> = {
  participant: {
    title: 'Individual',
    blurb:
      'Register as an individual participant, create or join a team, submit projects, and participate in hackathons.',
    formTitle: 'Individual Registration',
  },
  college: {
    title: 'Institution',
    blurb:
      'Register your institution to manage students, organize hackathons, monitor participation, and access reports.',
    formTitle: 'Institution Registration',
  },
  jury: {
    title: 'Jury Member',
    blurb: 'Register to evaluate submissions and mentor teams.',
    formTitle: 'Jury Registration',
  },
}

const successCopy: Record<RegisterRole, { title: string; body: string }> = {
  participant: {
    title: "You're registered!",
    body: 'Your account is active — log in now to browse open hackathons, register, and build your team.',
  },
  college: {
    title: 'Submitted for review',
    body: "Your institution's registration is with our admin team. You'll receive your login credentials by email once approved.",
  },
  jury: {
    title: 'Submitted for review',
    body: "Your registration is with our admin team. You'll receive your login credentials by email once approved.",
  },
}

/**
 * Shared registration UI. Pass a single role to skip the selector entirely
 * (used by the hidden /jury/register route); pass multiple to show a picker.
 */
export function RegistrationFlow({ roles }: { roles: RegisterRole[] }) {
  const [role, setRole] = useState<RegisterRole | null>(roles.length === 1 ? roles[0] : null)
  const [success, setSuccess] = useState<RegisterRole | null>(null)
  const showSelector = roles.length > 1
  // Jury has its own sign-in entry point at /jury; everyone else uses the shared /login.
  const loginHref = (success ?? role) === 'jury' ? '/jury' : '/login'

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
          <a href={loginHref} className="btn btn-primary" style={{ padding: '12px 28px' }}>
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
            {roles.map((r) => (
              <button
                key={r}
                onClick={() => setRole(r)}
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
                  {roleMeta[r].title}
                </div>
                <div style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.5 }}>{roleMeta[r].blurb}</div>
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
          {showSelector && (
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
          )}
          <h2
            style={{
              marginBottom: '24px',
              fontSize: '26px',
              color: 'var(--text-primary)',
              fontFamily: 'var(--font-display)',
            }}
          >
            {roleMeta[role].formTitle}
          </h2>
          {role === 'participant' && <ParticipantRegisterForm onSuccess={() => setSuccess('participant')} />}
          {role === 'college' && <CollegeRegisterForm onSuccess={() => setSuccess('college')} />}
          {role === 'jury' && <JuryRegisterForm onSuccess={() => setSuccess('jury')} />}
        </div>
      )}
    </div>
  )
}
