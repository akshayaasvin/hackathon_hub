'use client'

import React, { useState, useEffect, useRef } from 'react'
import HeroBackground from '@/components/HeroBackground'
import { 
  Trophy, Rocket, Cpu, Code, GitFork, Sparkles,
  Users, Award, ArrowRight, Box, TrendingUp, Zap
} from 'lucide-react'

function CountUp({ end, duration = 2000 }: { end: number; duration?: number }) {
  const [count, setCount] = useState(0)
  useEffect(() => {
    let startTimestamp: number | null = null
    let animationFrameId: number
    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp
      const progress = Math.min((timestamp - startTimestamp) / duration, 1)
      setCount(Math.floor(progress * end))
      if (progress < 1) animationFrameId = window.requestAnimationFrame(step)
    }
    animationFrameId = window.requestAnimationFrame(step)
    return () => window.cancelAnimationFrame(animationFrameId)
  }, [end, duration])
  return <>{count.toLocaleString()}</>
}

function RevealOnScroll({ children }: { children: React.ReactNode }) {
  const [isVisible, setIsVisible] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setIsVisible(true); observer.unobserve(entry.target) } },
      { threshold: 0.15 }
    )
    if (ref.current) observer.observe(ref.current)
    return () => { if (ref.current) observer.unobserve(ref.current) }
  }, [])
  return <div ref={ref} className={`reveal-section ${isVisible ? 'is-visible' : ''}`}>{children}</div>
}

export default function Home() {
  return (
    <div className="landing-bright-wrapper">
      <HeroBackground />

      <div className="hero-section-container">
        {/* Floating Tech Icons */}
        <Trophy  className="floating-tech-icon" size={32} style={{ top: '12%',  left: '8%',   color: '#6C47FF' }} />
        <Rocket  className="floating-tech-icon" size={30} style={{ top: '22%',  right: '8%',  color: '#00C47A', animationDelay: '-2s' }} />
        <Cpu     className="floating-tech-icon" size={30} style={{ bottom: '22%', left: '10%', color: '#3B82F6', animationDelay: '-5s' }} />
        <Users   className="floating-tech-icon" size={28} style={{ bottom: '16%', right: '12%', color: '#6C47FF', animationDelay: '-8s' }} />
        <Code    className="floating-tech-icon" size={30} style={{ top: '45%',  left: '4%',   color: '#00C47A', animationDelay: '-3s' }} />
        <Box     className="floating-tech-icon" size={28} style={{ top: '50%',  right: '5%',  color: '#3B82F6', animationDelay: '-6s' }} />
        <GitFork className="floating-tech-icon" size={26} style={{ top: '8%',   right: '28%', color: '#6C47FF', animationDelay: '-1s' }} />
        <Award   className="floating-tech-icon" size={30} style={{ bottom: '35%', right: '28%', color: '#00C47A', animationDelay: '-4s' }} />
        <TrendingUp className="floating-tech-icon" size={26} style={{ bottom: '38%', left: '26%', color: '#3B82F6', animationDelay: '-7s' }} />

        <div className="hero-fade-in-wrapper">
          <div
            className="glass-card-saas float-hero-card hero-main-card"
            style={{ maxWidth: '640px', padding: '50px 40px', position: 'relative', zIndex: 10, boxSizing: 'border-box' }}
          >
            <div className="glass-sweep-reflection" />

            {/* Logo mark in card */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', marginBottom: '18px' }}>
              <svg width="40" height="40" viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M22 3L39 12.5V31.5L22 41L5 31.5V12.5L22 3Z" fill="rgba(108,71,255,0.06)" stroke="#6C47FF" strokeWidth="1.5"/>
                <path d="M25 8L14 24H21L19 36L30 20H23L25 8Z" fill="#6C47FF"/>
                <circle cx="35" cy="9" r="4.5" fill="#00C47A"/>
                <path d="M22 10L34 17V31L22 38L10 31V17L22 10Z" stroke="rgba(108,71,255,0.12)" strokeWidth="0.8" fill="none"/>
              </svg>
              <span style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 800, fontSize: '22px', letterSpacing: '-0.02em', lineHeight: 1 }}>
                <span style={{ color: '#6C47FF' }}>Hackathon</span>
                <span style={{ color: '#0A0E1A' }}>Hub</span>
              </span>
            </div>

            {/* Terminal eyebrow */}
            <div className="terminal-eyebrow" style={{ marginLeft: 'auto', marginRight: 'auto', width: 'fit-content' }}>
              <Zap size={12} />
              <span>next-generation portal · now live</span>
              <span className="cursor-blink" />
            </div>

            <h1
              className="animated-gradient-text-bright"
              style={{
                fontSize: '54px', marginBottom: '18px',
                fontFamily: 'Space Grotesk, sans-serif', fontWeight: 800,
                letterSpacing: '-0.04em', lineHeight: '1.06'
              }}
            >
              Hackathon Manager
            </h1>

            <p style={{
              fontSize: '16px', color: 'var(--text-secondary)', lineHeight: '1.65',
              marginBottom: '36px', maxWidth: '500px', marginLeft: 'auto', marginRight: 'auto',
            }}>
              The ultimate platform for organizers, participants, and jury members to coordinate,
              submit projects, and evaluate hackathons — end to end.
            </p>

            <div style={{ display: 'flex', justifyContent: 'center', gap: '14px', flexWrap: 'wrap' }} className="flex-mobile-wrap">
              <a href="/login" className="btn-cta-primary-bright">
                Login to Dashboard
                <ArrowRight size={17} className="cta-arrow" style={{ transition: 'transform 0.3s' }} />
              </a>
              <a href="/register" className="btn-cta-secondary-bright">
                Register Now
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
