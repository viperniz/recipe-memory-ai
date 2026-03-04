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
// Film Grain Overlay (SVG noise)
// =============================================
function FilmGrain() {
  return (
    <div className="cs-grain" aria-hidden="true">
      <svg>
        <filter id="cs-noise">
          <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#cs-noise)" opacity="1" />
      </svg>
    </div>
  )
}

// =============================================
// Ambient Particles (Canvas)
// =============================================
function AmbientParticles() {
  const canvasRef = useRef(null)

  useEffect(() => {
    const c = canvasRef.current
    if (!c) return
    const ctx = c.getContext('2d')
    const DPR = Math.min(window.devicePixelRatio || 1, 2)
    let animId

    const particles = []
    const COUNT = 80

    function resize() {
      c.width = Math.round(window.innerWidth * DPR)
      c.height = Math.round(document.documentElement.scrollHeight * DPR)
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0)
    }

    function init() {
      resize()
      particles.length = 0
      const pageH = document.documentElement.scrollHeight
      for (let i = 0; i < COUNT; i++) {
        particles.push({
          x: Math.random() * window.innerWidth,
          y: Math.random() * pageH,
          r: Math.random() * 1.5 + 0.3,
          a: Math.random() * 0.3 + 0.05,
          dx: (Math.random() - 0.5) * 0.15,
          dy: (Math.random() - 0.5) * 0.1,
          phase: Math.random() * Math.PI * 2,
        })
      }
    }

    init()

    function draw() {
      const now = Date.now() * 0.001
      const pageH = document.documentElement.scrollHeight
      ctx.clearRect(0, 0, window.innerWidth, pageH)

      for (const p of particles) {
        p.x += p.dx
        p.y += p.dy
        if (p.x < 0) p.x = window.innerWidth
        if (p.x > window.innerWidth) p.x = 0
        if (p.y < 0) p.y = pageH
        if (p.y > pageH) p.y = 0

        const pulse = 0.5 + 0.5 * Math.sin(now * 0.8 + p.phase)
        ctx.globalAlpha = p.a * pulse
        ctx.fillStyle = '#fff'
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.globalAlpha = 1
      animId = requestAnimationFrame(draw)
    }

    animId = requestAnimationFrame(draw)

    const onResize = () => init()
    window.addEventListener('resize', onResize)

    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener('resize', onResize)
    }
  }, [])

  return <canvas ref={canvasRef} className="cs-particles" />
}

// =============================================
// Loading Screen
// =============================================
function LoadingScreen({ onDone }) {
  const ref = useRef(null)
  const barRef = useRef(null)

  useEffect(() => {
    // Animate progress bar
    gsap.fromTo(
      barRef.current,
      { scaleX: 0 },
      {
        scaleX: 1,
        duration: 1.4,
        ease: 'power2.inOut',
      }
    )

    const timer = setTimeout(() => {
      gsap.to(ref.current, {
        opacity: 0,
        duration: 0.6,
        ease: 'power2.inOut',
        onComplete: onDone,
      })
    }, 1600)
    return () => clearTimeout(timer)
  }, [onDone])

  return (
    <div ref={ref} className="cs-loader">
      <div className="cs-loader-inner">
        <p className="cs-loader-text">
          Initializing Cortexle
          <span className="cs-loader-dot">.</span>
          <span className="cs-loader-dot">.</span>
          <span className="cs-loader-dot">.</span>
        </p>
        <div className="cs-loader-bar">
          <div ref={barRef} className="cs-loader-bar-fill" />
        </div>
      </div>
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
      <div className="cs-navbar-links">
        <span className="cs-navbar-link">Vision</span>
        <span className="cs-navbar-sep">/</span>
        <span className="cs-navbar-link">Framework</span>
        <span className="cs-navbar-sep">/</span>
        <span className="cs-navbar-link">Process</span>
      </div>
      <button className="cs-navbar-cta" onClick={scrollToWaitlist}>
        Join Waitlist
      </button>
    </nav>
  )
}

// =============================================
// Hero Section (with brain image)
// =============================================
function HeroSection({ loaded, heroRef }) {
  const headingRef = useRef(null)
  const dividerRef = useRef(null)
  const subRef = useRef(null)
  const brainRef = useRef(null)
  const badgeRef = useRef(null)

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
            ease: 'power4.out',
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

      // Brain image reveals with scale + fade
      gsap.fromTo(
        brainRef.current,
        { opacity: 0, scale: 0.85 },
        { opacity: 1, scale: 1, duration: 1.4, delay: 0.4, ease: 'power2.out' }
      )

      // Badge slides in
      gsap.fromTo(
        badgeRef.current,
        { opacity: 0, y: 15 },
        { opacity: 1, y: 0, duration: 0.6, delay: 1.2, ease: 'power2.out' }
      )

      // Parallax brain on scroll
      gsap.to(brainRef.current, {
        yPercent: -15,
        ease: 'none',
        scrollTrigger: {
          trigger: heroRef.current,
          start: 'top top',
          end: 'bottom top',
          scrub: true,
        },
      })
    }, heroRef)

    return () => ctx.revert()
  }, [loaded, heroRef])

  return (
    <section ref={heroRef} className="cs-hero">
      <div ref={brainRef} className="cs-hero-brain">
        <img
          src="/images/brain-hero.webp"
          alt=""
          className="cs-hero-brain-img"
          draggable="false"
        />
        <div className="cs-hero-brain-glow" />
      </div>
      <div className="cs-hero-content">
        <div ref={badgeRef} className="cs-hero-badge">
          <span className="cs-hero-badge-dot" />
          AI-POWERED KNOWLEDGE ENGINE
        </div>
        <h1 ref={headingRef} className="cs-hero-heading">
          <SplitChars text="YOUR SECOND BRAIN" className="cs-hero-line" />
        </h1>
        <div ref={dividerRef} className="cs-hero-divider" />
        <p ref={subRef} className="cs-hero-sub">
          Process any video. Extract knowledge.<br />Remember everything.
        </p>
      </div>
    </section>
  )
}

// =============================================
// Infinite Marquee
// =============================================
const MARQUEE_ITEMS = [
  'VISION AI', 'SMART NOTES', 'SEMANTIC SEARCH', 'AI CHAT',
  'FLASHCARDS', 'MIND MAPS', 'STUDY GUIDES', 'EXPORT ANYWHERE',
  'YOUTUBE', 'LOCAL FILES', 'COLLECTIONS', 'KNOWLEDGE BASE',
]

function Marquee() {
  const items = [...MARQUEE_ITEMS, ...MARQUEE_ITEMS]
  return (
    <div className="cs-marquee">
      <div className="cs-marquee-track">
        {items.map((item, i) => (
          <span key={i} className="cs-marquee-item">
            {item}
            <span className="cs-marquee-dot" />
          </span>
        ))}
      </div>
    </div>
  )
}

// =============================================
// Vision Section (with brain-neural parallax)
// =============================================
function VisionSection() {
  const sectionRef = useRef(null)
  const imgRef = useRef(null)

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

      // Parallax on the image break
      if (imgRef.current) {
        gsap.fromTo(
          imgRef.current,
          { yPercent: -10 },
          {
            yPercent: 10,
            ease: 'none',
            scrollTrigger: {
              trigger: imgRef.current.parentElement,
              start: 'top bottom',
              end: 'bottom top',
              scrub: true,
            },
          }
        )
      }
    }, sectionRef)

    return () => ctx.revert()
  }, [])

  return (
    <>
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

      {/* Full-bleed parallax image break */}
      <div className="cs-img-break">
        <img
          ref={imgRef}
          src="/brain-neural.jpg"
          alt=""
          className="cs-img-break-src"
          draggable="false"
        />
        <div className="cs-img-break-overlay" />
      </div>
    </>
  )
}

// =============================================
// Stats Marquee (animated counters)
// =============================================
function StatsBar() {
  const ref = useRef(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!ref.current) return
    const ctx = gsap.context(() => {
      ScrollTrigger.create({
        trigger: ref.current,
        start: 'top 85%',
        once: true,
        onEnter: () => setVisible(true),
      })
    }, ref)
    return () => ctx.revert()
  }, [])

  return (
    <div ref={ref} className="cs-stats">
      <StatItem label="Formats Supported" value={50} suffix="+" visible={visible} />
      <StatItem label="Faster Than Rewatching" value={10} suffix="x" visible={visible} />
      <StatItem label="AI Accuracy" value={98} suffix="%" visible={visible} />
      <StatItem label="Hours Saved Per Week" value={12} suffix="+" visible={visible} />
    </div>
  )
}

function StatItem({ label, value, suffix, visible }) {
  const numRef = useRef(null)

  useEffect(() => {
    if (!visible || !numRef.current) return
    gsap.fromTo(
      numRef.current,
      { innerText: 0 },
      {
        innerText: value,
        duration: 2,
        ease: 'power2.out',
        snap: { innerText: 1 },
        onUpdate() {
          if (numRef.current) {
            numRef.current.textContent = Math.round(
              parseFloat(numRef.current.style.getPropertyValue('--v') || numRef.current.innerText)
            )
          }
        },
      }
    )
  }, [visible, value])

  return (
    <div className="cs-stat">
      <span className="cs-stat-num">
        <span ref={numRef}>{visible ? value : 0}</span>{suffix}
      </span>
      <span className="cs-stat-label">{label}</span>
    </div>
  )
}

// =============================================
// Pillars Section
// =============================================
const PILLARS = [
  {
    num: '01',
    icon: '👁',
    title: 'VISION AI',
    sub: 'See What Others Miss',
    desc: 'Captures diagrams, slides, code, and visual content directly from video frames — information that transcripts alone would never reveal.',
  },
  {
    num: '02',
    icon: '🧠',
    title: 'SMART NOTES',
    sub: 'Memory That Never Fades',
    desc: 'AI-generated summaries, key points, and structured notes that distill hours of content into actionable knowledge.',
  },
  {
    num: '03',
    icon: '🔍',
    title: 'SEMANTIC SEARCH',
    sub: 'Find Anything, Instantly',
    desc: 'Search in plain English across your entire video library. Find concepts, not just keywords — even across hundreds of hours.',
  },
  {
    num: '04',
    icon: '💬',
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
          { opacity: 0, y: 60, scale: 0.96 },
          {
            opacity: 1,
            y: 0,
            scale: 1,
            duration: 0.7,
            stagger: 0.12,
            ease: 'power3.out',
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
            <div className="cs-pillar-header">
              <span className="cs-pillar-num">{p.num}</span>
              <span className="cs-pillar-icon">{p.icon}</span>
            </div>
            <h3 className="cs-pillar-title">{p.title}</h3>
            <p className="cs-pillar-sub">{p.sub}</p>
            <p className="cs-pillar-desc">{p.desc}</p>
            <div className="cs-pillar-glow" />
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
          { opacity: 0, x: -30 },
          {
            opacity: 1,
            x: 0,
            duration: 0.6,
            stagger: 0.15,
            ease: 'power3.out',
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
            <div className="cs-step-progress" />
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
  { old: 'Manual timestamps and notes', new: 'AI-extracted structured knowledge' },
  { old: 'Keyword search fails on concepts', new: 'Semantic search understands meaning' },
  { old: 'Rewatch entire videos for one detail', new: 'Instant answers from your knowledge base' },
  { old: 'Content trapped in one platform', new: 'Export anywhere: Markdown, Notion, PDF' },
  { old: 'Transcripts miss visual content', new: 'Vision AI reads what\'s on screen' },
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
      {blocks.map((b, i) => (
        <React.Fragment key={b.label}>
          <div className="cs-cd-block">
            <span className="cs-cd-num">{String(b.val).padStart(2, '0')}</span>
            <span className="cs-cd-label">{b.label}</span>
          </div>
          {i < blocks.length - 1 && <span className="cs-cd-sep">:</span>}
        </React.Fragment>
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
      <FilmGrain />
      <AmbientParticles />
      {!loaded && <LoadingScreen onDone={handleLoaderDone} />}
      <Navbar heroRef={heroRef} />
      <main>
        <HeroSection loaded={loaded} heroRef={heroRef} />
        <Marquee />
        <VisionSection />
        <StatsBar />
        <PillarsSection />
        <ProcessSection />
        <ComparisonSection />
        <WaitlistSection />
      </main>
      <FooterSection />
    </div>
  )
}
