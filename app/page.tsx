'use client'

import React, { useState, useEffect, useRef } from 'react'
import HeroBackground from '@/components/HeroBackground'
import HeroIllustration from '@/components/HeroIllustration'
import FeaturedHackathons from '@/components/landing/FeaturedHackathons'
import {
  Trophy, Rocket, Cpu, Code, GitFork, Award,
  ArrowRight, Zap,
  UserPlus, Gavel, School, GraduationCap,
  DollarSign, Compass, ShieldCheck, ChevronDown
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

const heroStats = [
  { value: 50, suffix: '+', label: 'Hackathons planned' },
  { value: 200, suffix: '+', label: 'Colleges onboarding' },
  { value: 10000, suffix: '+', label: 'Student capacity' },
  { value: 500, suffix: '+', label: 'Startup track seats' },
]

const benefits = [
  {
    icon: <ShieldCheck size={24} />,
    title: 'A certificate for every participant',
    desc: 'Every registered participant earns a certificate with a unique verification code — proof of real work, not just attendance.',
  },
  {
    icon: <DollarSign size={24} />,
    title: 'Real prize money for the best demos',
    desc: 'Top-ranked teams are judged on a transparent 100-point rubric and walk away with cash prizes, not just bragging rights.',
  },
  {
    icon: <Rocket size={24} />,
    title: 'A path from standout idea to funding',
    desc: "Projects that impress the jury get introduced to incubation and funding conversations — this isn't a dead end after demo day.",
  },
  {
    icon: <GraduationCap size={24} />,
    title: 'Student to founder, one hackathon at a time',
    desc: 'HackathonHub is built to be the first step in a longer founder journey — mentorship and momentum, not just a weekend event.',
  },
]

const steps = [
  {
    icon: <UserPlus size={22} />,
    title: '1. Register & form a team',
    desc: 'Sign up as a student, pick a hackathon, and team up with up to four collaborators — or fly solo.',
  },
  {
    icon: <Code size={22} />,
    title: '2. Build & submit your project',
    desc: 'Ship your idea before the deadline: repo link, demo video, pitch deck, and a written solution.',
  },
  {
    icon: <Gavel size={22} />,
    title: '3. Present to expert jury',
    desc: 'Industry and academic judges score your work on innovation, technical depth, UX, feasibility, and delivery.',
  },
  {
    icon: <Trophy size={22} />,
    title: '4. Win prizes, funding & certificates',
    desc: 'Top teams take home cash prizes, funding introductions, and every participant gets a verifiable certificate.',
  },
]

const faqs = [
  {
    q: 'Is there a registration fee?',
    a: 'No. Registering for a hackathon on HackathonHub is free for students.',
  },
  {
    q: 'How does college / jury approval work?',
    a: "Colleges and jury members apply through a short form. An admin reviews the application, and once approved, credentials are emailed directly — there's no self-serve access before that review.",
  },
  {
    q: 'How do I form a team?',
    a: 'After registering for a hackathon, create a team from your participant dashboard and invite teammates by email — up to the hackathon\'s max team size.',
  },
  {
    q: 'How is my certificate verified?',
    a: 'Every certificate carries a unique certificate ID and verification code, so anyone can confirm it\'s real — no unverifiable attendance certificates.',
  },
  {
    q: 'How is judging scored?',
    a: 'Assigned jury members score submissions across five weighted categories — innovation, technical depth, UX, feasibility, and presentation — for a transparent 100-point total.',
  },
]

export default function Home() {
  return (
    <div className="landing-bright-wrapper">
      <HeroBackground />

      <div className="hero-banner-container">
        {/* Floating Tech Icons */}
        <Trophy  className="floating-tech-icon" size={32} style={{ top: '10%',  left: '4%',   color: '#6C47FF' }} />
        <Rocket  className="floating-tech-icon" size={28} style={{ top: '18%',  left: '46%',  color: '#00C47A', animationDelay: '-2s' }} />
        <Cpu     className="floating-tech-icon" size={30} style={{ bottom: '18%', left: '8%',  color: '#3B82F6', animationDelay: '-5s' }} />
        <GitFork className="floating-tech-icon" size={26} style={{ top: '8%',   left: '30%',  color: '#6C47FF', animationDelay: '-1s' }} />
        <Award   className="floating-tech-icon" size={26} style={{ bottom: '30%', left: '38%', color: '#00C47A', animationDelay: '-4s' }} />

        <div className="hero-fade-in-wrapper">
          <div className="hero-grid">
            {/* ── LEFT: content ── */}
            <div className="hero-grid-left">
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                <svg width="36" height="36" viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M22 3L39 12.5V31.5L22 41L5 31.5V12.5L22 3Z" fill="rgba(108,71,255,0.06)" stroke="#6C47FF" strokeWidth="1.5"/>
                  <path d="M25 8L14 24H21L19 36L30 20H23L25 8Z" fill="#6C47FF"/>
                  <circle cx="35" cy="9" r="4.5" fill="#00C47A"/>
                  <path d="M22 10L34 17V31L22 38L10 31V17L22 10Z" stroke="rgba(108,71,255,0.12)" strokeWidth="0.8" fill="none"/>
                </svg>
                <span style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 800, fontSize: '20px', letterSpacing: '-0.02em', lineHeight: 1 }}>
                  <span style={{ color: '#6C47FF' }}>Hackathon</span>
                  <span style={{ color: '#0A0E1A' }}>Hub</span>
                </span>
              </div>

              <div className="terminal-eyebrow">
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
                Turn Your Idea Into a Funded Startup
              </h1>

              <p style={{ fontSize: '17px', color: 'var(--text-secondary)', lineHeight: '1.65', marginBottom: '32px', maxWidth: '560px' }}>
                Register, build with a team, and pitch to real industry jury. Every participant earns a
                verifiable certificate, top teams win prize money and mentorship, and standout projects get
                a path to funding — with your college recognized for backing you.
              </p>

              <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap' }} className="flex-mobile-wrap">
                <a href="/register" className="btn-cta-primary-bright">
                  Register Now
                  <ArrowRight size={17} className="cta-arrow" style={{ transition: 'transform 0.3s' }} />
                </a>
                <a href="/login" className="btn-cta-secondary-bright">
                  Login to Dashboard
                </a>
              </div>

              <div className="hero-stats-row">
                {heroStats.map((s) => (
                  <div key={s.label} className="hero-stat-item">
                    <span className="hero-stat-value"><CountUp end={s.value} />{s.suffix}</span>
                    <span className="hero-stat-label">{s.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* ── RIGHT: illustration ── */}
            <div className="hero-grid-right">
              <div className="glass-card-saas" style={{ padding: '32px', width: '100%' }}>
                <HeroIllustration />
              </div>
            </div>
          </div>
        </div>

        <div className="scroll-indicator">
          <span>Scroll to explore</span>
          <ChevronDown size={18} className="scroll-indicator-chevron" />
        </div>
      </div>

      {/* Wave divider */}
      <div className="section-wave-divider">
        <svg viewBox="0 0 1440 80" preserveAspectRatio="none">
          <path d="M0,40 C240,80 480,0 720,20 C960,40 1200,80 1440,40 L1440,80 L0,80 Z" fill="rgba(108,71,255,0.04)" />
        </svg>
      </div>

      {/* ── BENEFITS (why join / what you get) ── */}
      <RevealOnScroll>
        <div className="premium-container" style={{ width: '100%' }}>
          <h2 className="section-title">Why Join HackathonHub</h2>
          <p className="section-subtitle">
            This isn't a weekend certificate mill — it's built to compound into something real.
          </p>
          <div className="features-grid">
            {benefits.map((item) => (
              <div key={item.title} className="premium-feature-card">
                <div className="feature-icon-wrapper">{item.icon}</div>
                <h3 className="feature-title">{item.title}</h3>
                <p className="feature-desc">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </RevealOnScroll>

      {/* ── HOW IT WORKS ── */}
      <RevealOnScroll>
        <div className="premium-container" style={{ width: '100%' }}>
          <h2 className="section-title">How It Works</h2>
          <p className="section-subtitle">
            From sign-up to demo day in four steps — no guesswork, no hidden gates.
          </p>
          <div className="features-grid">
            {steps.map((step) => (
              <div key={step.title} className="premium-feature-card">
                <div className="feature-icon-wrapper">{step.icon}</div>
                <h3 className="feature-title">{step.title}</h3>
                <p className="feature-desc">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </RevealOnScroll>

      {/* ── FEATURED HACKATHONS ── */}
      <RevealOnScroll>
        <div className="premium-container" style={{ width: '100%' }}>
          <h2 className="section-title">Featured Hackathons</h2>
          <p className="section-subtitle">Open for registration right now.</p>
          <div style={{ marginBottom: '24px' }}>
            <FeaturedHackathons />
          </div>
        </div>
      </RevealOnScroll>

      {/* ── FOR COLLEGES / FOR JURY ── */}
      <RevealOnScroll>
        <div className="premium-container" style={{ width: '100%' }}>
          <div className="responsive-grid-2" style={{ gap: '24px', marginBottom: '24px' }}>
            <div className="glass-card" style={{ padding: '32px' }}>
              <div className="feature-icon-wrapper" style={{ marginBottom: '20px' }}>
                <School size={24} />
              </div>
              <h3 style={{ fontSize: '22px', fontFamily: 'var(--font-display)', marginBottom: '12px', color: 'var(--text-primary)' }}>
                For Colleges
              </h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '15px', lineHeight: '1.7', marginBottom: '16px' }}>
                Register your institution and get a live dashboard tracking every student's journey —
                registered, teamed up, submitted, evaluated, ranked. Colleges get recognition and rewards
                when their students perform, turning participation into institutional bragging rights.
              </p>
              <a href="/register" style={{ color: 'var(--primary)', fontWeight: 600, fontSize: '14px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                Register your college <ArrowRight size={14} />
              </a>
            </div>

            <div className="glass-card" style={{ padding: '32px' }}>
              <div className="feature-icon-wrapper" style={{ marginBottom: '20px' }}>
                <Gavel size={24} />
              </div>
              <h3 style={{ fontSize: '22px', fontFamily: 'var(--font-display)', marginBottom: '12px', color: 'var(--text-primary)' }}>
                For Jury
              </h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '15px', lineHeight: '1.7', marginBottom: '16px' }}>
                Industry engineers, founders, and faculty score assigned teams on a structured rubric —
                and go further with written feedback that guides students on what to fix next. It's career
                guidance, not just a scoreboard.
              </p>
              <a href="/register" style={{ color: 'var(--primary)', fontWeight: 600, fontSize: '14px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                Apply as a jury member <ArrowRight size={14} />
              </a>
            </div>
          </div>
        </div>
      </RevealOnScroll>

      {/* ── FAQ ── */}
      <RevealOnScroll>
        <div className="premium-container" style={{ width: '100%' }}>
          <h2 className="section-title">Frequently Asked Questions</h2>
          <p className="section-subtitle">The mechanics, in plain terms.</p>
          <div className="faq-list">
            {faqs.map((item) => (
              <details key={item.q} className="faq-item">
                <summary>{item.q}</summary>
                <p>{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </RevealOnScroll>

      {/* ── FOOTER CTA ── */}
      <RevealOnScroll>
        <div className="premium-container" style={{ width: '100%', paddingBottom: '80px' }}>
          <div className="glass-card-saas" style={{ padding: '56px 40px', textAlign: 'center', maxWidth: '760px', margin: '0 auto' }}>
            <Compass size={28} color="var(--primary)" style={{ marginBottom: '16px' }} />
            <h2 style={{ fontSize: '30px', fontFamily: 'var(--font-display)', fontWeight: 800, marginBottom: '14px', color: 'var(--text-primary)' }}>
              Ready to build something real?
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '15px', marginBottom: '32px', maxWidth: '480px', marginLeft: 'auto', marginRight: 'auto' }}>
              Whether you're a student with an idea, a college backing your students, or an expert ready to
              mentor — there's a seat for you.
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '14px', flexWrap: 'wrap' }} className="flex-mobile-wrap">
              <a href="/register" className="btn-cta-primary-bright">
                Register Now <ArrowRight size={17} />
              </a>
              <a href="/login" className="btn-cta-secondary-bright">
                Login to Dashboard
              </a>
            </div>
          </div>
        </div>
      </RevealOnScroll>
    </div>
  )
}
