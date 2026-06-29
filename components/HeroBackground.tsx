'use client'

import React, { useState, useEffect } from 'react'

export default function HeroBackground() {
  const [animationsPaused, setAnimationsPaused] = useState<boolean>(false)
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })

  // Load preferences from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('hero-bg-animations-paused')
    if (stored === 'true') {
      setAnimationsPaused(true)
    }
  }, [])

  // Mouse move and scroll listener for parallax effect
  useEffect(() => {
    if (animationsPaused) return

    let lastMouseX = 0
    let lastMouseY = 0

    const updateParallax = () => {
      const scrollY = typeof window !== 'undefined' ? window.scrollY : 0
      const scrollProgress = scrollY / (typeof window !== 'undefined' ? window.innerHeight : 1)
      
      setMousePos({
        x: lastMouseX,
        y: lastMouseY + scrollProgress * 0.4 // scroll drifts elements vertically
      })
    }

    const handleMouseMove = (e: MouseEvent) => {
      lastMouseX = (e.clientX / window.innerWidth) - 0.5
      lastMouseY = (e.clientY / window.innerHeight) - 0.5
      updateParallax()
    }

    const handleScroll = () => {
      updateParallax()
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('scroll', handleScroll, { passive: true })
    
    // Initial call
    updateParallax()

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('scroll', handleScroll)
    }
  }, [animationsPaused])

  const toggleAnimations = () => {
    const nextState = !animationsPaused
    setAnimationsPaused(nextState)
    localStorage.setItem('hero-bg-animations-paused', String(nextState))
    if (nextState) {
      setMousePos({ x: 0, y: 0 }) // Reset position when paused
    }
  }

  return (
    <div className={`hero-bg-container-bright ${animationsPaused ? 'animations-paused' : ''}`}>
      {/* 1. Futuristic Glowing Mesh Blobs (with Mouse Parallax) */}
      <div 
        className="glowing-blob-bright blob-purple" 
        style={{
          transform: `translate(${mousePos.x * 35}px, ${mousePos.y * 35}px)`
        }} 
      />
      <div 
        className="glowing-blob-bright blob-blue" 
        style={{
          transform: `translate(${mousePos.x * -45}px, ${mousePos.y * -45}px)`
        }} 
      />
      <div 
        className="glowing-blob-bright blob-cyan" 
        style={{
          transform: `translate(${mousePos.x * 20}px, ${mousePos.y * 20}px)`
        }} 
      />

      {/* 8. Moving Light Beams */}
      <div className="light-beam beam-1" />
      <div className="light-beam beam-2" />

      {/* 2. Technical Grid Overlay */}
      <svg className="grid-overlay" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="tech-grid" width="60" height="60" patternUnits="userSpaceOnUse">
            <path d="M 60 0 L 0 0 0 60" fill="none" stroke="rgba(108,71,255,0.08)" strokeWidth="1" />
            <circle cx="0" cy="0" r="1.5" fill="rgba(108,71,255,0.25)" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#tech-grid)" />
      </svg>

      {/* 3. Floating Geometric Shapes (with Mouse Parallax) */}
      <div 
        className="hero-bg-layer"
        style={{
          transform: `translate(${mousePos.x * 15}px, ${mousePos.y * 15}px)`,
          transition: 'transform 0.15s cubic-bezier(0.1, 0.8, 0.2, 1)'
        }}
      >
        {/* Shape 1: Tech Hexagon */}
        <svg className="floating-shape shape-1" width="80" height="80" viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ color: '#a855f7' }}>
          <polygon points="50,5 92,29 92,71 50,95 8,71 8,29" strokeDasharray="3 3" />
          <circle cx="50" cy="50" r="15" stroke="currentColor" strokeWidth="1" />
        </svg>

        {/* Shape 2: Crosshair / Target */}
        <svg className="floating-shape shape-2" width="60" height="60" viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: '#06b6d4' }}>
          <circle cx="50" cy="50" r="28" strokeDasharray="5 5" />
          <line x1="50" y1="10" x2="50" y2="90" strokeDasharray="2 4" />
          <line x1="10" y1="50" x2="90" y2="50" strokeDasharray="2 4" />
        </svg>

        {/* Shape 3: Code Brackets */}
        <svg className="floating-shape shape-3" width="50" height="50" viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: '#3b82f6' }}>
          <path d="M35,25 L15,25 L15,75 L35,75" />
          <path d="M65,25 L85,25 L85,75 L65,75" />
          <circle cx="50" cy="50" r="6" fill="currentColor" fillOpacity="0.3" />
        </svg>

        {/* Shape 4: Grid tech fragment */}
        <svg className="floating-shape shape-4" width="90" height="90" viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="1" style={{ color: '#10b981' }}>
          <rect x="15" y="15" width="30" height="30" rx="3" strokeDasharray="4 2" />
          <rect x="55" y="15" width="30" height="30" rx="3" />
          <rect x="15" y="55" width="30" height="30" rx="3" />
          <circle cx="70" cy="70" r="12" fill="currentColor" fillOpacity="0.15" />
        </svg>
      </div>

      {/* 4. Moving Network Connection Lines */}
      <svg className="network-lines" viewBox="0 0 1000 600" preserveAspectRatio="none" fill="none" color="#a855f7">
        {/* Connection Lines with Dash Animations */}
        <line x1="150" y1="100" x2="350" y2="180" stroke="currentColor" strokeWidth="1" className="network-pulse-line" />
        <line x1="350" y1="180" x2="250" y2="350" stroke="currentColor" strokeWidth="1" className="network-pulse-line" />
        <line x1="350" y1="180" x2="550" y2="150" stroke="currentColor" strokeWidth="1.2" className="network-pulse-line" />
        <line x1="550" y1="150" x2="700" y2="320" stroke="currentColor" strokeWidth="1" className="network-pulse-line" />
        <line x1="700" y1="320" x2="850" y2="200" stroke="currentColor" strokeWidth="1" className="network-pulse-line" />
        <line x1="700" y1="320" x2="600" y2="450" stroke="currentColor" strokeWidth="1" className="network-pulse-line" />
        <line x1="250" y1="350" x2="600" y2="450" stroke="currentColor" strokeWidth="1.2" className="network-pulse-line" />
        <line x1="250" y1="350" x2="100" y2="480" stroke="currentColor" strokeWidth="1" className="network-pulse-line" />
        <line x1="850" y1="200" x2="900" y2="380" stroke="currentColor" strokeWidth="1" className="network-pulse-line" />
        <line x1="550" y1="150" x2="450" y2="50" stroke="currentColor" strokeWidth="1" className="network-pulse-line" />
        
        {/* Nodes (Glowing Points) */}
        <circle cx="150" cy="100" r="3" fill="#06b6d4" className="network-node" />
        <circle cx="350" cy="180" r="3.5" fill="#a855f7" className="network-node" />
        <circle cx="250" cy="350" r="3" fill="#3b82f6" className="network-node" />
        <circle cx="550" cy="150" r="4" fill="#10b981" className="network-node" />
        <circle cx="700" cy="320" r="3.5" fill="#a855f7" className="network-node" />
        <circle cx="850" cy="200" r="3" fill="#06b6d4" className="network-node" />
        <circle cx="600" cy="450" r="4.5" fill="#10b981" className="network-node" />
        <circle cx="100" cy="480" r="3.5" fill="#a855f7" className="network-node" />
        <circle cx="900" cy="380" r="4" fill="#06b6d4" className="network-node" />
        <circle cx="450" cy="50" r="3" fill="#3b82f6" className="network-node" />
      </svg>

      {/* 5. Drifting Light Particles */}
      <div className="hero-bg-layer">
        <div className="light-particle" style={{ width: '4px', height: '4px', top: '20%', left: '15%', animationDelay: '0s' }} />
        <div className="light-particle" style={{ width: '6px', height: '6px', top: '50%', left: '30%', animationDelay: '-2s' }} />
        <div className="light-particle" style={{ width: '3px', height: '3px', top: '75%', left: '10%', animationDelay: '-5s' }} />
        <div className="light-particle" style={{ width: '5px', height: '5px', top: '35%', left: '80%', animationDelay: '-1s' }} />
        <div className="light-particle" style={{ width: '4px', height: '4px', top: '65%', left: '70%', animationDelay: '-6s' }} />
        <div className="light-particle" style={{ width: '7px', height: '7px', top: '15%', left: '60%', animationDelay: '-3s' }} />
        <div className="light-particle" style={{ width: '3px', height: '3px', top: '85%', left: '50%', animationDelay: '-8s' }} />
        <div className="light-particle" style={{ width: '5px', height: '5px', top: '45%', left: '90%', animationDelay: '-4s' }} />
        <div className="light-particle" style={{ width: '4px', height: '4px', top: '25%', left: '45%', animationDelay: '-9s' }} />
        <div className="light-particle" style={{ width: '6px', height: '6px', top: '60%', left: '20%', animationDelay: '-7s' }} />
        <div className="light-particle" style={{ width: '5px', height: '5px', top: '80%', left: '75%', animationDelay: '-11s' }} />
        <div className="light-particle" style={{ width: '3px', height: '3px', top: '10%', left: '85%', animationDelay: '-13s' }} />
      </div>

      {/* 9. Twinkling Stars (with Mouse Parallax) */}
      <div 
        className="hero-bg-layer"
        style={{
          transform: `translate(${mousePos.x * 8}px, ${mousePos.y * 8}px)`,
          transition: 'transform 0.2s cubic-bezier(0.1, 0.8, 0.2, 1)'
        }}
      >
        <div className="star-particle" style={{ width: '3px', height: '3px', top: '15%', left: '25%', animationDelay: '0s' }} />
        <div className="star-particle" style={{ width: '2px', height: '2px', top: '40%', left: '75%', animationDelay: '-1.5s' }} />
        <div className="star-particle" style={{ width: '4px', height: '4px', top: '70%', left: '18%', animationDelay: '-3s' }} />
        <div className="star-particle" style={{ width: '3px', height: '3px', top: '85%', left: '80%', animationDelay: '-4.5s' }} />
        <div className="star-particle" style={{ width: '2px', height: '2px', top: '30%', left: '50%', animationDelay: '-2s' }} />
        <div className="star-particle" style={{ width: '3px', height: '3px', top: '65%', left: '88%', animationDelay: '-5.5s' }} />
      </div>

      {/* 6. Subtle Digital Wave Effects */}
      <div 
        className="wave-layer" 
        style={{ 
          opacity: 0.12,
          transform: `translateY(${mousePos.y * 10}px)`
        }}
      >
        <svg className="digital-wave wave-1" viewBox="0 0 2880 200" preserveAspectRatio="none">
          <path d="M 0 110 Q 360 60, 720 110 T 1440 110 Q 1800 60, 2160 110 T 2880 110 L 2880 200 L 0 200 Z" fill="#a855f7" />
        </svg>
        <svg className="digital-wave wave-2" viewBox="0 0 2880 200" preserveAspectRatio="none">
          <path d="M 0 130 Q 360 85, 720 130 T 1440 130 Q 1800 85, 2160 130 T 2880 130 L 2880 200 L 0 200 Z" fill="#06b6d4" />
        </svg>
      </div>

      {/* 7. Performance Fallback Control */}
      <button
        onClick={toggleAnimations}
        title={animationsPaused ? "Enable Background Animations" : "Disable Background Animations"}
        style={{
          position: 'absolute',
          bottom: '24px',
          right: '24px',
          padding: '6px 12px',
          fontSize: '11px',
          fontFamily: 'var(--font-sans)',
          fontWeight: 600,
          background: 'rgba(108,71,255,0.08)',
          border: '1px solid rgba(108,71,255,0.15)',
          borderRadius: '20px',
          color: 'var(--text-muted)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          zIndex: 10,
          transition: 'var(--transition-smooth)'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'rgba(108,71,255,0.14)'
          e.currentTarget.style.color = 'var(--primary)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'rgba(108,71,255,0.08)'
          e.currentTarget.style.color = 'var(--text-muted)'
        }}
      >
        <span style={{
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          backgroundColor: animationsPaused ? '#64748b' : '#10b981',
          display: 'inline-block'
        }} />
        {animationsPaused ? 'Animations Off' : 'Animations On'}
      </button>
    </div>
  )
}
