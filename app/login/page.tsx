'use client'

import { useEffect } from 'react'
import { AuthForm } from '../../components/auth/AuthForm'

export default function LoginPage() {
  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.search.includes('reset=true')) {
      localStorage.clear()
      document.cookie = 'mock_user=; path=/; max-age=0'
      window.location.href = '/login'
    }
  }, [])

  return (
    <div style={{
      minHeight: 'calc(100vh - 64px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      <AuthForm isLogin={true} />
    </div>
  )
}