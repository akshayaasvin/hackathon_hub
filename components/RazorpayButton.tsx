'use client'

import { useEffect, useRef } from 'react'

// Embeds Razorpay's own hosted payment button — admin only supplies the
// Button ID from their Razorpay dashboard, no custom checkout logic here.
export function RazorpayButton({ buttonId }: { buttonId: string }) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    container.innerHTML = ''

    const form = document.createElement('form')
    const script = document.createElement('script')
    script.src = 'https://checkout.razorpay.com/v1/payment-button.js'
    script.async = true
    script.setAttribute('data-payment_button_id', buttonId)
    form.appendChild(script)
    container.appendChild(form)
  }, [buttonId])

  return <div ref={containerRef} />
}
