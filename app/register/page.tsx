'use client'

import { RegistrationFlow } from '@/components/auth/RegistrationFlow'

// Jury registration is intentionally not offered here — it's reachable
// directly at /jury/register for judges who already have the link, but
// isn't advertised on the public registration page.
export default function RegisterPage() {
  return <RegistrationFlow roles={['participant', 'college']} />
}
