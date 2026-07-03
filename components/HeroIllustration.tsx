'use client'

import { Cpu, Terminal, Rocket, Sparkles, Trophy } from 'lucide-react'

const badges = [
  { icon: <Cpu size={16} />, top: '4%', left: '2%', color: '#6C47FF', delay: '0s' },
  { icon: <Terminal size={16} />, top: '10%', right: '0%', color: '#00C47A', delay: '-3s' },
  { icon: <Rocket size={16} />, bottom: '14%', left: '-2%', color: '#3B82F6', delay: '-6s' },
  { icon: <Sparkles size={16} />, top: '46%', right: '-4%', color: '#00C47A', delay: '-2s' },
  { icon: <Trophy size={16} />, bottom: '2%', right: '10%', color: '#6C47FF', delay: '-4.5s' },
]

const codeLines = [
  { width: '78%', color: '#6C47FF' },
  { width: '55%', color: '#3B82F6' },
  { width: '68%', color: '#00C47A' },
  { width: '40%', color: '#6C47FF' },
  { width: '62%', color: '#3B82F6' },
]

export default function HeroIllustration() {
  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        maxWidth: '420px',
        aspectRatio: '1 / 1',
        margin: '0 auto',
      }}
    >
      {/* Ambient glow behind the device */}
      <div
        style={{
          position: 'absolute',
          inset: '10%',
          background: 'radial-gradient(circle, rgba(108,71,255,0.16) 0%, rgba(0,196,122,0.08) 45%, transparent 70%)',
          filter: 'blur(30px)',
          borderRadius: '50%',
        }}
      />

      {/* Connecting lines */}
      <svg
        viewBox="0 0 400 400"
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
      >
        <g stroke="rgba(108,71,255,0.25)" strokeWidth="1" strokeDasharray="4 5">
          <line x1="200" y1="200" x2="40" y2="45" />
          <line x1="200" y1="200" x2="365" y2="70" />
          <line x1="200" y1="200" x2="20" y2="320" />
          <line x1="200" y1="200" x2="380" y2="220" />
          <line x1="200" y1="200" x2="320" y2="370" />
        </g>
        <circle cx="200" cy="200" r="3" fill="#6C47FF" />
      </svg>

      {/* Central "code editor" device */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '72%',
          borderRadius: '18px',
          background: 'rgba(255,255,255,0.85)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(108,71,255,0.16)',
          boxShadow: '0 24px 48px -12px rgba(108,71,255,0.22)',
          overflow: 'hidden',
          animation: 'floatHeroCard 9s infinite ease-in-out alternate',
        }}
      >
        <div
          style={{
            display: 'flex',
            gap: '6px',
            padding: '12px 16px',
            borderBottom: '1px solid rgba(108,71,255,0.10)',
            background: 'rgba(108,71,255,0.03)',
          }}
        >
          <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#EF4444' }} />
          <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#F59E0B' }} />
          <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#10B981' }} />
        </div>
        <div style={{ padding: '20px 18px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {codeLines.map((line, i) => (
            <span
              key={i}
              style={{
                display: 'block',
                height: '8px',
                borderRadius: '4px',
                width: line.width,
                background: line.color,
                opacity: 0.28,
              }}
            />
          ))}
        </div>
      </div>

      {/* Floating icon badges */}
      {badges.map((b, i) => (
        <div
          key={i}
          className="floating-tech-icon"
          style={{
            position: 'absolute',
            top: b.top,
            left: (b as any).left,
            right: (b as any).right,
            bottom: (b as any).bottom,
            width: 40,
            height: 40,
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(255,255,255,0.85)',
            backdropFilter: 'blur(12px)',
            border: `1px solid ${b.color}33`,
            color: b.color,
            boxShadow: `0 8px 20px -6px ${b.color}55`,
            opacity: 1,
            animationDelay: b.delay,
            filter: 'none',
          }}
        >
          {b.icon}
        </div>
      ))}
    </div>
  )
}
