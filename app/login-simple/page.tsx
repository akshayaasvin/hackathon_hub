'use client'

import { useState } from 'react'
import { createClient } from '../../lib/supabase/client'

export default function SimpleLogin() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const supabase = createClient()

  const handleLogin = async () => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) alert(error.message)
    else alert('Login successful!')
  }

  return (
    <div style={{ padding: '50px', textAlign: 'center' }}>
      <h1>Test Login</h1>
      <input 
        type="email" 
        placeholder="Email" 
        value={email} 
        onChange={(e) => setEmail(e.target.value)} 
        style={{ display: 'block', margin: '10px auto', padding: '10px', width: '300px' }} 
      />
      <input 
        type="password" 
        placeholder="Password" 
        value={password} 
        onChange={(e) => setPassword(e.target.value)} 
        style={{ display: 'block', margin: '10px auto', padding: '10px', width: '300px' }} 
      />
      <button 
        onClick={handleLogin} 
        style={{ padding: '10px 20px', background: 'blue', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}
      >
        Login
      </button>
    </div>
  )
}



