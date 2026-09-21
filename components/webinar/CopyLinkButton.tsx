'use client'

import { useState } from 'react'
import { Check, Copy } from 'lucide-react'

/** One-click "copy the meeting link" button (with a fallback for browsers without the Clipboard API). */
export default function CopyLinkButton({ url, small = false }: { url: string; small?: boolean }) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url)
    } catch {
      const el = document.createElement('textarea')
      el.value = url
      el.style.position = 'fixed'
      el.style.opacity = '0'
      document.body.appendChild(el)
      el.select()
      try {
        document.execCommand('copy')
      } catch {}
      el.remove()
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      type="button"
      onClick={copy}
      className="btn btn-secondary"
      style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', ...(small ? { padding: '8px 14px', fontSize: '13px' } : {}) }}
    >
      {copied ? <Check size={small ? 14 : 16} /> : <Copy size={small ? 14 : 16} />}
      {copied ? 'Copied!' : 'Copy link'}
    </button>
  )
}
