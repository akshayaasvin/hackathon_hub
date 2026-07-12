'use client'

// Floating support button, fixed bottom-right, present on every page (root
// layout). z-index sits below the dashboard drawer/overlay (998/999 in
// globals.css) so it never fights with the mobile sidebar for taps.
const SUPPORT_MESSAGE = 'Hi, I need help with HackathonHub registration.'

export default function WhatsAppButton() {
  const phoneNumber = process.env.NEXT_PUBLIC_WHATSAPP_SUPPORT_NUMBER
  if (!phoneNumber) return null

  const href = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(SUPPORT_MESSAGE)}`

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat with HackathonHub support on WhatsApp"
      title="Chat with us on WhatsApp"
      style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        width: '56px',
        height: '56px',
        borderRadius: '50%',
        background: '#25D366',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
        zIndex: 900,
        textDecoration: 'none',
      }}
    >
      <svg width="30" height="30" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path
          d="M16.004 4C9.377 4 4 9.373 4 15.996c0 2.116.554 4.183 1.605 6.006L4 28l6.15-1.577a12.02 12.02 0 0 0 5.854 1.492h.005c6.627 0 12.004-5.373 12.004-11.996C28.013 9.297 22.635 4 16.004 4Z"
          fill="white"
        />
        <path
          d="M23.61 19.062c-.315-.157-1.862-.918-2.151-1.023-.289-.105-.499-.157-.71.158-.209.315-.812 1.023-.996 1.233-.184.21-.368.236-.683.079-.315-.158-1.33-.49-2.533-1.562-.936-.835-1.569-1.867-1.753-2.182-.184-.315-.02-.485.138-.642.142-.141.315-.368.472-.552.158-.184.21-.315.315-.525.105-.21.052-.394-.026-.552-.079-.157-.71-1.71-.973-2.342-.256-.615-.516-.531-.71-.541l-.605-.011a1.161 1.161 0 0 0-.842.394c-.289.315-1.102 1.077-1.102 2.627 0 1.55 1.128 3.048 1.286 3.258.157.21 2.22 3.39 5.378 4.754.751.324 1.336.518 1.793.663.753.24 1.438.206 1.98.125.604-.09 1.862-.762 2.125-1.498.262-.736.262-1.367.184-1.498-.079-.132-.288-.21-.603-.368Z"
          fill="#25D366"
        />
      </svg>
    </a>
  )
}
