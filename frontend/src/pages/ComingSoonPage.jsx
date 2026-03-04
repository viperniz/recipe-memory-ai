import React, { useEffect, useRef, useState, useCallback } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import useLenis, { getLenis } from '../hooks/useLenis'
import { API_BASE } from '../lib/apiBase'

gsap.registerPlugin(ScrollTrigger)

// =============================================
// SplitChars — wraps each character in a span
// =============================================
function SplitChars({ text, className = '' }) {
  const words = text.split(' ')
  return (
    <span className={className}>
      {words.map((word, wi) => (
        <span key={wi} className="cs-word">
          {word.split('').map((char, ci) => (
            <span key={ci} className="cs-char">{char}</span>
          ))}
          {wi < words.length - 1 && <span className="cs-char">&nbsp;</span>}
        </span>
      ))}
    </span>
  )
}

// =============================================
// Loading Screen
// =============================================
function LoadingScreen({ onDone }) {
  const ref = useRef(null)

  useEffect(() => {
    const timer = setTimeout(() => {
      gsap.to(ref.current, {
        opacity: 0,
        duration: 0.6,
        ease: 'power2.inOut',
        onComplete: onDone,
      })
    }, 1500)
    return () => clearTimeout(timer)
  }, [onDone])

  return (
    <div ref={ref} className="cs-loader">
      <p className="cs-loader-text">
        Initializing Cortexle
        <span className="cs-loader-dot">.</span>
        <span className="cs-loader-dot">.</span>
        <span className="cs-loader-dot">.</span>
      </p>
    </div>
  )
}

// =============================================
// Navbar
// =============================================
function Navbar({ heroRef }) {
  const navRef = useRef(null)

  useEffect(() => {
    if (!heroRef?.current || !navRef.current) return

    const ctx = gsap.context(() => {
      ScrollTrigger.create({
        trigger: heroRef.current,
        start: 'bottom top',
        onEnter: () => navRef.current?.classList.add('cs-scrolled'),
        onLeaveBack: () => navRef.current?.classList.remove('cs-scrolled'),
      })
    })

    return () => ctx.revert()
  }, [heroRef])

  const scrollToWaitlist = () => {
    const lenis = getLenis()
    const target = document.querySelector('#cs-waitlist')
    if (lenis && target) {
      lenis.scrollTo(target, { offset: -60 })
    } else if (target) {
      target.scrollIntoView({ behavior: 'smooth' })
    }
  }

  return (
    <nav ref={navRef} className="cs-navbar">
      <span className="cs-navbar-logo">CORTEXLE</span>
      <button className="cs-navbar-cta" onClick={scrollToWaitlist}>
        Join Waitlist
      </button>
    </nav>
  )
}

// =============================================
// Hero Section
// =============================================
function HeroSection({ loaded, heroRef }) {
  const headingRef = useRef(null)
  const dividerRef = useRef(null)
  const subRef = useRef(null)

  useEffect(() => {
    if (!loaded) return

    const ctx = gsap.context(() => {
      const chars = headingRef.current?.querySelectorAll('.cs-char')
      if (chars?.length) {
        gsap.fromTo(
          chars,
          { yPercent: 118, opacity: 0 },
          {
            yPercent: 0,
            opacity: 1,
            duration: 0.8,
            stagger: 0.02,
            ease: 'power3.out',
          }
        )
      }

      gsap.fromTo(
        dividerRef.current,
        { scaleX: 0 },
        { scaleX: 1, duration: 0.8, delay: 0.6, ease: 'power2.out' }
      )

      gsap.fromTo(
        subRef.current,
        { opacity: 0, y: 20 },
        { opacity: 1, y: 0, duration: 0.8, delay: 0.8, ease: 'power2.out' }
      )
    }, heroRef)

    return () => ctx.revert()
  }, [loaded, heroRef])

  return (
    <section ref={heroRef} className="cs-hero">
      <h1 ref={headingRef} className="cs-hero-heading">
        <SplitChars text="YOUR AI-POWERED SECOND BRAIN" className="cs-hero-line" />
      </h1>
      <div ref={dividerRef} className="cs-hero-divider" />
      <p ref={subRef} className="cs-hero-sub">
        Process any video. Extract knowledge. Remember everything.
      </p>
    </section>
  )
}

// =============================================
// Vision Section
// =============================================
function VisionSection() {
  const sectionRef = useRef(null)

  useEffect(() => {
    const ctx = gsap.context(() => {
      const chars = sectionRef.current?.querySelectorAll('.cs-vision-quote .cs-char')
      if (chars?.length) {
        gsap.fromTo(
          chars,
          { opacity: 0, yPercent: 60 },
          {
            opacity: 1,
            yPercent: 0,
            duration: 0.5,
            stagger: 0.008,
            ease: 'power2.out',
            scrollTrigger: {
              trigger: sectionRef.current,
              start: 'top 80%',
            },
          }
        )
      }

      const paras = sectionRef.current?.querySelectorAll('.cs-vision-body p')
      if (paras?.length) {
        gsap.fromTo(
          paras,
          { opacity: 0, y: 30 },
          {
            opacity: 1,
            y: 0,
            duration: 0.7,
            stagger: 0.2,
            ease: 'power2.out',
            scrollTrigger: {
              trigger: sectionRef.current,
              start: 'top 65%',
            },
          }
        )
      }
    }, sectionRef)

    return () => ctx.revert()
  }, [])

  return (
    <section ref={sectionRef} className="cs-vision">
      <blockquote className="cs-vision-quote">
        <SplitChars text="The knowledge you consume already exists within reach. Most of it is lost — buried in hours of video you'll never rewatch." />
      </blockquote>
      <div className="cs-vision-body">
        <p>
          We believe the future belongs to those who can recall what they've learned — instantly, effortlessly, and in context. Not through memorization, but through intelligent systems that work alongside your curiosity.
        </p>
        <p>
          Cortexle transforms passive video consumption into structured, searchable intelligence. Every lecture, tutorial, and documentary becomes part of your permanent knowledge base.
        </p>
      </div>
    </section>
  )
}

// =============================================
// Pillars Section
// =============================================
const PILLARS = [
  {
    num: '01',
    title: 'VISION AI',
    sub: 'See What Others Miss',
    desc: 'Captures diagrams, slides, code, and visual content directly from video frames — information that transcripts alone would never reveal.',
  },
  {
    num: '02',
    title: 'SMART NOTES',
    sub: 'Memory That Never Fades',
    desc: 'AI-generated summaries, key points, and structured notes that distill hours of content into actionable knowledge.',
  },
  {
    num: '03',
    title: 'SEMANTIC SEARCH',
    sub: 'Find Anything, Instantly',
    desc: 'Search in plain English across your entire video library. Find concepts, not just keywords — even across hundreds of hours of content.',
  },
  {
    num: '04',
    title: 'AI CHAT',
    sub: 'Your Knowledge, Conversational',
    desc: 'Ask questions about any video and receive cited, contextual answers drawn from your personal knowledge base.',
  },
]

function PillarsSection() {
  const sectionRef = useRef(null)

  useEffect(() => {
    const ctx = gsap.context(() => {
      const cards = sectionRef.current?.querySelectorAll('.cs-pillar')
      if (cards?.length) {
        gsap.fromTo(
          cards,
          { opacity: 0, y: 40 },
          {
            opacity: 1,
            y: 0,
            duration: 0.6,
            stagger: 0.15,
            ease: 'power2.out',
            scrollTrigger: {
              trigger: sectionRef.current,
              start: 'top 80%',
            },
          }
        )
      }
    }, sectionRef)

    return () => ctx.revert()
  }, [])

  return (
    <section ref={sectionRef} className="cs-pillars">
      <p className="cs-section-label">THE CORTEXLE FRAMEWORK</p>
      <div className="cs-pillars-grid">
        {PILLARS.map((p) => (
          <div key={p.num} className="cs-pillar">
            <span className="cs-pillar-num">{p.num}</span>
            <h3 className="cs-pillar-title">{p.title}</h3>
            <p className="cs-pillar-sub">{p.sub}</p>
            <p className="cs-pillar-desc">{p.desc}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

// =============================================
// Process / How It Works Section
// =============================================
const STEPS = [
  {
    num: '01',
    title: 'UPLOAD',
    desc: 'Paste a YouTube link or upload a local video file. Any format, any length.',
  },
  {
    num: '02',
    title: 'PROCESS',
    desc: 'AI transcribes, analyzes, and extracts visual content automatically — no manual work required.',
  },
  {
    num: '03',
    title: 'EXTRACT',
    desc: 'Structured notes, key points, and searchable knowledge are generated in seconds.',
  },
  {
    num: '04',
    title: 'REMEMBER',
    desc: 'Your personal knowledge base grows with every video you process. Nothing is ever lost.',
  },
]

function ProcessSection() {
  const sectionRef = useRef(null)

  useEffect(() => {
    const ctx = gsap.context(() => {
      const steps = sectionRef.current?.querySelectorAll('.cs-process-step')
      if (steps?.length) {
        gsap.fromTo(
          steps,
          { opacity: 0, y: 30 },
          {
            opacity: 1,
            y: 0,
            duration: 0.6,
            stagger: 0.15,
            ease: 'power2.out',
            scrollTrigger: {
              trigger: sectionRef.current,
              start: 'top 80%',
            },
          }
        )
      }
    }, sectionRef)

    return () => ctx.revert()
  }, [])

  return (
    <section ref={sectionRef} className="cs-process">
      <p className="cs-section-label">HOW IT WORKS</p>
      <div className="cs-process-steps">
        {STEPS.map((s) => (
          <div key={s.num} className="cs-process-step">
            <div className="cs-step-left">
              <span className="cs-step-num">{s.num}</span>
              <span className="cs-step-title">{s.title}</span>
            </div>
            <div className="cs-step-right">
              <p className="cs-step-desc">{s.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

// =============================================
// Comparison Section
// =============================================
const COMPARISONS = [
  {
    old: 'Manual timestamps and notes',
    new: 'AI-extracted structured knowledge',
  },
  {
    old: 'Keyword search fails on concepts',
    new: 'Semantic search understands meaning',
  },
  {
    old: 'Rewatch entire videos for one detail',
    new: 'Instant answers from your knowledge base',
  },
  {
    old: 'Content trapped in one platform',
    new: 'Export anywhere: Markdown, Notion, PDF',
  },
  {
    old: 'Transcripts miss visual content',
    new: 'Vision AI reads what\'s on screen',
  },
]

function ComparisonSection() {
  const sectionRef = useRef(null)

  useEffect(() => {
    const ctx = gsap.context(() => {
      const rows = sectionRef.current?.querySelectorAll('.cs-comp-row')
      if (rows?.length) {
        gsap.fromTo(
          rows,
          { opacity: 0, y: 20 },
          {
            opacity: 1,
            y: 0,
            duration: 0.5,
            stagger: 0.12,
            ease: 'power2.out',
            scrollTrigger: {
              trigger: sectionRef.current,
              start: 'top 80%',
            },
          }
        )
      }
    }, sectionRef)

    return () => ctx.revert()
  }, [])

  return (
    <section ref={sectionRef} className="cs-comparison">
      <p className="cs-section-label">A DIFFERENT APPROACH</p>
      <div className="cs-comp-header">
        <span className="cs-comp-old">THE OLD WAY</span>
        <span className="cs-comp-new">CORTEXLE</span>
      </div>
      <div className="cs-comp-grid">
        {COMPARISONS.map((c, i) => (
          <div key={i} className="cs-comp-row">
            <span className="cs-comp-old">{c.old}</span>
            <span className="cs-comp-new">{c.new}</span>
          </div>
        ))}
      </div>
    </section>
  )
}

// =============================================
// Countdown Timer
// =============================================
function Countdown({ target }) {
  const [time, setTime] = useState({ d: 0, h: 0, m: 0, s: 0 })

  useEffect(() => {
    const targetDate = new Date(target)
    function tick() {
      let diff = Math.max(0, targetDate - new Date())
      const d = Math.floor(diff / 86400000); diff %= 86400000
      const h = Math.floor(diff / 3600000); diff %= 3600000
      const m = Math.floor(diff / 60000); diff %= 60000
      const s = Math.floor(diff / 1000)
      setTime({ d, h, m, s })
    }
    tick()
    const iv = setInterval(tick, 1000)
    return () => clearInterval(iv)
  }, [target])

  const blocks = [
    { val: time.d, label: 'Days' },
    { val: time.h, label: 'Hours' },
    { val: time.m, label: 'Mins' },
    { val: time.s, label: 'Secs' },
  ]

  return (
    <div className="cs-countdown">
      {blocks.map((b) => (
        <div key={b.label} className="cs-cd-block">
          <span className="cs-cd-num">{String(b.val).padStart(2, '0')}</span>
          <span className="cs-cd-label">{b.label}</span>
        </div>
      ))}
    </div>
  )
}

// =============================================
// Waitlist CTA Section
// =============================================
function WaitlistSection() {
  const sectionRef = useRef(null)
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')
  const [waitlistCount, setWaitlistCount] = useState(null)

  useEffect(() => {
    fetch(`${API_BASE}/waitlist/count`)
      .then((r) => r.json())
      .then((data) => setWaitlistCount(data.count))
      .catch(() => {})
  }, [submitted])

  useEffect(() => {
    const ctx = gsap.context(() => {
      const chars = sectionRef.current?.querySelectorAll('.cs-wl-heading .cs-char')
      if (chars?.length) {
        gsap.fromTo(
          chars,
          { opacity: 0, yPercent: 60 },
          {
            opacity: 1,
            yPercent: 0,
            duration: 0.5,
            stagger: 0.01,
            ease: 'power2.out',
            scrollTrigger: {
              trigger: sectionRef.current,
              start: 'top 80%',
            },
          }
        )
      }

      const form = sectionRef.current?.querySelector('.cs-wl-form')
      if (form) {
        gsap.fromTo(
          form,
          { opacity: 0, y: 30 },
          {
            opacity: 1,
            y: 0,
            duration: 0.7,
            delay: 0.3,
            ease: 'power2.out',
            scrollTrigger: {
              trigger: sectionRef.current,
              start: 'top 80%',
            },
          }
        )
      }
    }, sectionRef)

    return () => ctx.revert()
  }, [])

  const handleSubmit = useCallback(async () => {
    const val = email.trim()
    if (!val || !val.includes('@')) {
      setError('Please enter a valid email address')
      return
    }
    try {
      const res = await fetch(`${API_BASE}/waitlist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: val }),
      })
      if (res.ok) {
        setSubmitted(true)
        setError('')
      } else {
        const data = await res.json()
        setError(data.detail || 'Something went wrong')
      }
    } catch {
      setError('Network error')
    }
  }, [email])

  return (
    <section ref={sectionRef} id="cs-waitlist" className="cs-waitlist">
      <p className="cs-section-label">EARLY ACCESS</p>
      <h2 className="cs-wl-heading">
        <SplitChars text="Be among the first to experience a new way of learning from video." />
      </h2>
      <div className="cs-wl-form">
        <div className="cs-wl-input-row">
          <input
            className="cs-wl-input"
            type="email"
            placeholder="Enter your email address"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value)
              setError('')
            }}
            disabled={submitted}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          />
          <button
            className="cs-wl-btn"
            onClick={handleSubmit}
            disabled={submitted}
          >
            {submitted ? "You're In" : 'Request Access'}
          </button>
        </div>
        {error && <p className="cs-wl-error">{error}</p>}
        {waitlistCount !== null && waitlistCount > 0 && (
          <p className="cs-wl-count">
            Join {waitlistCount.toLocaleString()} {waitlistCount === 1 ? 'person' : 'others'} on the waitlist
          </p>
        )}
      </div>
      <Countdown target="2026-09-01T00:00:00Z" />
      <p className="cs-launch-date">Launching September 2026</p>
    </section>
  )
}

// =============================================
// Footer
// =============================================
function FooterSection() {
  return (
    <footer className="cs-footer">
      <span>&copy; 2026 Cortexle</span>
      <span className="cs-footer-links">
        Privacy &middot; Terms
      </span>
    </footer>
  )
}

// =============================================
// ComingSoonPage — Main
// =============================================
export default function ComingSoonPage() {
  const [loaded, setLoaded] = useState(false)
  const heroRef = useRef(null)
  useLenis()

  const handleLoaderDone = useCallback(() => {
    setLoaded(true)
  }, [])

  return (
    <div className="cs-page">
      {!loaded && <LoadingScreen onDone={handleLoaderDone} />}
      <Navbar heroRef={heroRef} />
      <main>
        <HeroSection loaded={loaded} heroRef={heroRef} />
        <VisionSection />
        <PillarsSection />
        <ProcessSection />
        <ComparisonSection />
        <WaitlistSection />
      </main>
      <FooterSection />
    </div>
  )
}
