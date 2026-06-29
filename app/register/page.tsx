'use client'

import { AuthForm } from '../../components/auth/AuthForm'

export default function RegisterPage() {
  return (
    <div style={{
      minHeight: 'calc(100vh - 64px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      <AuthForm isLogin={false} />
    </div>
  )
}