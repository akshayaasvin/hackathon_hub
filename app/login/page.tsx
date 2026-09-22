'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { LoginForm } from '@/components/auth/LoginForm'

// The confirmation email links back to /login?confirmed=1 (success) or, if the link was
// already used or has expired, Supabase appends its own error=/error_code=/error_description=
// params instead — previously shown nowhere, so the earlier ONLY visible symptom was a later,
// unrelated-looking "Email not confirmed" box once the visitor tried to sign in.
function noticeFromSearchParams(params: URLSearchParams): { type: 'error' | 'success'; message: string } | undefined {
  const errorCode = params.get('error_code')
  if (errorCode) {
    if (errorCode === 'otp_expired') {
      return {
        type: 'error',
        message: 'That confirmation link has already been used or has expired. Go to Register and submit the same email again to get a new one.',
      }
    }
    return { type: 'error', message: params.get('error_description')?.replace(/\+/g, ' ') || 'That confirmation link is no longer valid.' }
  }
  if (params.get('confirmed') === '1') {
    return { type: 'success', message: 'Your email is confirmed — you can log in now.' }
  }
  return undefined
}

function LoginPageInner() {
  const notice = noticeFromSearchParams(useSearchParams())
  return <LoginForm initialNotice={notice} />
}

export default function LoginPage() {
  return (
    <div
      style={{
        minHeight: 'calc(100vh - 64px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Suspense fallback={<LoginForm />}>
        <LoginPageInner />
      </Suspense>
    </div>
  )
}
