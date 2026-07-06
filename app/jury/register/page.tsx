'use client'

import { RegistrationFlow } from '@/components/auth/RegistrationFlow'

// Deliberately not linked from any public page or nav — judges reach this
// by being given the direct URL. See app/register/page.tsx for the public
// registration page (Individual / Institution only).
export default function JuryRegisterPage() {
  return <RegistrationFlow roles={['jury']} />
}
