import React, { useEffect, useRef, useState, useCallback } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import useLenis, { getLenis } from '../hooks/useLenis'
import { API_BASE } from '../lib/apiBase'

gsap.registerPlugin(ScrollTrigger)

// =============================================
// SVG Icons (clean line style)
// =============================================
const ICONS = {
  eye: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ),
  brain: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2a5 5 0 0 1 4.5 2.8A4 4 0 0 1 20 8.5a4 4 0 0 1-1.3 7.2A5 5 0 0 1 12 22a5 5 0 0 1-6.7-6.3A4 4 0 0 1 4 8.5a4 4 0 0 1 3.5-3.7A5 5 0 0 1 12 2z" />
      <path d="M12 2v20" />
    </svg>
  ),
  search: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <path d="M21 21l-4.35-4.35" />
    </svg>
  ),
  chat: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  ),
}

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
// SplitWords — wraps each word in a span
// =============================================
function SplitWords({ text, className = '' }) {
  const words = text.split(' ')
  return (
    <span className={className}>
      {words.map((word, wi) => (
        <React.Fragment key={wi}>
          <span className="cs-reveal-word">{word}</span>
          {wi < words.length - 1 && <span className="cs-reveal-word">&nbsp;</span>}
        </React.Fragment>
      ))}
    </span>
  )
}

// =============================================
// Film Grain Overlay
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
    const COUNT = 60

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
          r: Math.random() * 1.2 + 0.3,
          a: Math.random() * 0.2 + 0.03,
          dx: (Math.random() - 0.5) * 0.12,
          dy: (Math.random() - 0.5) * 0.08,
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

        const pulse = 0.5 + 0.5 * Math.sin(now * 0.6 + p.phase)
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
    window.addEventListener('resize', init)
    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener('resize', init)
    }
  }, [])

  return <canvas ref={canvasRef} className="cs-particles" />
}

// =============================================
// Neural Tracer Canvas (overlays on brain image)
// Draws visible neural pathways with glowing light
// pulses that travel along them like electrical signals
// =============================================
function NeuralTracer({ containerRef }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    const c = canvasRef.current
    const container = containerRef?.current
    if (!c || !container) return
    const ctx = c.getContext('2d')
    const DPR = Math.min(window.devicePixelRatio || 1, 2)
    let animId
    let started = false

    // Neural pathways — cubic bezier curves in relative 0-1 coords
    // Constrained inside the brain (mask ellipse 55% 55% at 50% 48%)
    // Visible brain area roughly: X 0.30–0.70, Y 0.25–0.65
    const PATHWAYS = [
      // Left hemisphere — frontal curve
      [{ x: 0.36, y: 0.28 }, { x: 0.32, y: 0.34 }, { x: 0.33, y: 0.42 }, { x: 0.37, y: 0.48 }],
      // Left hemisphere — mid fold
      [{ x: 0.34, y: 0.36 }, { x: 0.30, y: 0.44 }, { x: 0.32, y: 0.52 }, { x: 0.38, y: 0.56 }],
      // Left hemisphere — lower curve
      [{ x: 0.38, y: 0.48 }, { x: 0.34, y: 0.54 }, { x: 0.37, y: 0.60 }, { x: 0.43, y: 0.62 }],
      // Right hemisphere — frontal curve
      [{ x: 0.64, y: 0.28 }, { x: 0.68, y: 0.34 }, { x: 0.67, y: 0.42 }, { x: 0.63, y: 0.48 }],
      // Right hemisphere — mid fold
      [{ x: 0.66, y: 0.36 }, { x: 0.70, y: 0.44 }, { x: 0.68, y: 0.52 }, { x: 0.62, y: 0.56 }],
      // Right hemisphere — lower curve
      [{ x: 0.62, y: 0.48 }, { x: 0.66, y: 0.54 }, { x: 0.63, y: 0.60 }, { x: 0.57, y: 0.62 }],
      // Corpus callosum — cross hemisphere
      [{ x: 0.37, y: 0.40 }, { x: 0.44, y: 0.37 }, { x: 0.56, y: 0.37 }, { x: 0.63, y: 0.40 }],
      // Central fissure — top to mid
      [{ x: 0.50, y: 0.26 }, { x: 0.49, y: 0.34 }, { x: 0.51, y: 0.44 }, { x: 0.50, y: 0.52 }],
      // Central fissure — mid to bottom
      [{ x: 0.50, y: 0.50 }, { x: 0.49, y: 0.56 }, { x: 0.50, y: 0.60 }, { x: 0.50, y: 0.64 }],
      // Left frontal inner fold
      [{ x: 0.42, y: 0.30 }, { x: 0.38, y: 0.36 }, { x: 0.40, y: 0.44 }, { x: 0.46, y: 0.42 }],
      // Right frontal inner fold
      [{ x: 0.58, y: 0.30 }, { x: 0.62, y: 0.36 }, { x: 0.60, y: 0.44 }, { x: 0.54, y: 0.42 }],
      // Left deep connector
      [{ x: 0.40, y: 0.44 }, { x: 0.42, y: 0.50 }, { x: 0.44, y: 0.56 }, { x: 0.48, y: 0.58 }],
      // Right deep connector
      [{ x: 0.60, y: 0.44 }, { x: 0.58, y: 0.50 }, { x: 0.56, y: 0.56 }, { x: 0.52, y: 0.58 }],
      // Cross — left upper to right mid
      [{ x: 0.38, y: 0.34 }, { x: 0.44, y: 0.40 }, { x: 0.54, y: 0.44 }, { x: 0.60, y: 0.48 }],
      // Cross — right upper to left mid
      [{ x: 0.62, y: 0.34 }, { x: 0.56, y: 0.40 }, { x: 0.46, y: 0.44 }, { x: 0.40, y: 0.48 }],
    ]

    // Pre-sample each pathway into polyline points for drawing line segments
    const SAMPLES = 60
    const pathPolylines = PATHWAYS.map(pts => {
      const line = []
      for (let i = 0; i <= SAMPLES; i++) {
        const t = i / SAMPLES
        line.push(cubicBezier(t, pts))
      }
      return line
    })

    function cubicBezier(t, pts) {
      const u = 1 - t
      return {
        x: u*u*u*pts[0].x + 3*u*u*t*pts[1].x + 3*u*t*t*pts[2].x + t*t*t*pts[3].x,
        y: u*u*u*pts[0].y + 3*u*u*t*pts[1].y + 3*u*t*t*pts[2].y + t*t*t*pts[3].y,
      }
    }

    // Tracer colors
    const COLORS = [
      'rgba(34,211,238,',   // cyan
      'rgba(120,160,255,',  // blue
      'rgba(167,139,250,',  // purple
      'rgba(255,255,255,',  // white
      'rgba(56,189,248,',   // sky
      'rgba(192,132,252,',  // violet
    ]

    // Each tracer is a thin glowing line segment traveling along a pathway
    class Tracer {
      constructor(staggerT) {
        this.pathIdx = Math.floor(Math.random() * PATHWAYS.length)
        this.color = COLORS[Math.floor(Math.random() * COLORS.length)]
        this.speed = 0.0012 + Math.random() * 0.0025
        this.segLen = 0.15 + Math.random() * 0.20     // length of lit segment
        this.dir = Math.random() > 0.5 ? 1 : -1
        this.head = staggerT != null ? staggerT : Math.random()
        this.lineWidth = 0.6 + Math.random() * 0.8    // thin lines
        this.pulsePhase = Math.random() * Math.PI * 2
      }

      reset() {
        this.pathIdx = Math.floor(Math.random() * PATHWAYS.length)
        this.color = COLORS[Math.floor(Math.random() * COLORS.length)]
        this.speed = 0.0012 + Math.random() * 0.0025
        this.segLen = 0.15 + Math.random() * 0.20
        this.dir = Math.random() > 0.5 ? 1 : -1
        this.head = this.dir > 0 ? -this.segLen : 1 + this.segLen
        this.lineWidth = 0.6 + Math.random() * 0.8
      }

      update() {
        this.head += this.speed * this.dir
        if (this.dir > 0 && this.head > 1 + this.segLen + 0.05) this.reset()
        if (this.dir < 0 && this.head < -this.segLen - 0.05) this.reset()
        this.pulsePhase += 0.03
      }

      draw(ctx, w, h) {
        const poly = pathPolylines[this.pathIdx]
        const tail = this.head - this.segLen * this.dir
        const tMin = Math.min(this.head, tail)
        const tMax = Math.max(this.head, tail)
        const pulse = 0.7 + 0.3 * Math.sin(this.pulsePhase)

        // Draw tracer as a continuous line with soft glow — 3 passes
        const passes = [
          { width: this.lineWidth * 5, alpha: 0.05 * pulse },  // soft outer glow
          { width: this.lineWidth * 2, alpha: 0.25 * pulse },  // mid glow
          { width: this.lineWidth, alpha: 0.85 * pulse },       // bright core line
        ]

        for (const pass of passes) {
          ctx.lineWidth = pass.width
          ctx.lineCap = 'round'
          ctx.lineJoin = 'round'

          // Draw segment-by-segment with edge fading
          for (let i = 1; i < poly.length; i++) {
            const t = i / SAMPLES
            const tPrev = (i - 1) / SAMPLES
            if (tPrev > tMax || t < tMin) continue

            // Fade at edges of tracer segment
            const mid = (t + tPrev) / 2
            const segPos = (mid - tMin) / (tMax - tMin)
            const edgeFade = Math.min(segPos * 3.5, (1 - segPos) * 3.5, 1)

            ctx.beginPath()
            ctx.moveTo(poly[i-1].x * w, poly[i-1].y * h)
            ctx.lineTo(poly[i].x * w, poly[i].y * h)
            ctx.strokeStyle = this.color + (pass.alpha * Math.max(0, edgeFade)) + ')'
            ctx.stroke()
          }
        }
      }
    }

    // Draw all pathways as very faint static lines (the neural network skeleton)
    function drawPathwayNetwork(ctx, w, h) {
      ctx.lineWidth = 0.5
      ctx.lineCap = 'round'
      ctx.strokeStyle = 'rgba(120, 180, 240, 0.04)'

      for (const poly of pathPolylines) {
        ctx.beginPath()
        ctx.moveTo(poly[0].x * w, poly[0].y * h)
        for (let i = 1; i < poly.length; i++) {
          ctx.lineTo(poly[i].x * w, poly[i].y * h)
        }
        ctx.stroke()
      }
    }

    // Create tracers — staggered along different pathways
    const tracers = []
    const TRACER_COUNT = 16
    for (let i = 0; i < TRACER_COUNT; i++) {
      tracers.push(new Tracer(Math.random()))
    }

    function resize() {
      const img = container.querySelector('img')
      const w = img ? img.offsetWidth : container.offsetWidth
      const h = img ? img.offsetHeight : container.offsetHeight
      if (w < 10 || h < 10) return false
      c.width = Math.round(w * DPR)
      c.height = Math.round(h * DPR)
      c.style.width = w + 'px'
      c.style.height = h + 'px'
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0)
      return true
    }

    let time = 0
    function animate() {
      if (!started) {
        started = resize()
        if (!started) { animId = requestAnimationFrame(animate); return }
      }
      const w = parseFloat(c.style.width) || 0
      const h = parseFloat(c.style.height) || 0
      if (w < 10) { animId = requestAnimationFrame(animate); return }

      ctx.clearRect(0, 0, w, h)
      time++

      // Draw faint static pathway network
      drawPathwayNetwork(ctx, w, h)

      // Draw each moving tracer
      for (const tr of tracers) {
        tr.update()
        tr.draw(ctx, w, h)
      }

      animId = requestAnimationFrame(animate)
    }

    animId = requestAnimationFrame(animate)
    const onResize = () => { resize() }
    window.addEventListener('resize', onResize)

    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener('resize', onResize)
    }
  }, [containerRef])

  return <canvas ref={canvasRef} className="cs-tracer-canvas" />
}

// =============================================
// Loading Screen
// =============================================
function LoadingScreen({ onDone }) {
  const ref = useRef(null)
  const barRef = useRef(null)

  useEffect(() => {
    gsap.fromTo(
      barRef.current,
      { scaleX: 0 },
      { scaleX: 1, duration: 1.4, ease: 'power2.inOut' }
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
const NAV_SECTIONS = [
  { label: 'Vision', id: 'cs-vision' },
  { label: 'Framework', id: 'cs-pillars' },
  { label: 'Process', id: 'cs-process' },
]

function Navbar({ heroRef }) {
  const navRef = useRef(null)
  const [activeId, setActiveId] = useState('')

  useEffect(() => {
    if (!heroRef?.current || !navRef.current) return
    const ctx = gsap.context(() => {
      ScrollTrigger.create({
        trigger: heroRef.current,
        start: 'bottom top',
        onEnter: () => navRef.current?.classList.add('cs-scrolled'),
        onLeaveBack: () => navRef.current?.classList.remove('cs-scrolled'),
      })

      // Track active section for nav highlighting
      NAV_SECTIONS.forEach(({ id }) => {
        const el = document.getElementById(id)
        if (!el) return
        ScrollTrigger.create({
          trigger: el,
          start: 'top center',
          end: 'bottom center',
          onToggle: ({ isActive }) => { if (isActive) setActiveId(id) },
        })
      })
    })
    return () => ctx.revert()
  }, [heroRef])

  const scrollTo = (id) => {
    const lenis = getLenis()
    const target = document.getElementById(id)
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
        {NAV_SECTIONS.map((s, i) => (
          <React.Fragment key={s.id}>
            <span
              className={`cs-navbar-link${activeId === s.id ? ' cs-navbar-link--active' : ''}`}
              onClick={() => scrollTo(s.id)}
            >
              {s.label}
            </span>
            {i < NAV_SECTIONS.length - 1 && <span className="cs-navbar-sep">/</span>}
          </React.Fragment>
        ))}
      </div>
      <button className="cs-navbar-cta" onClick={() => scrollTo('cs-waitlist')}>
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
  const brainRef = useRef(null)
  const badgeRef = useRef(null)

  useEffect(() => {
    if (!loaded) return
    const ctx = gsap.context(() => {
      const chars = headingRef.current?.querySelectorAll('.cs-char')
      if (chars?.length) {
        gsap.fromTo(chars, { yPercent: 118, opacity: 0 }, {
          yPercent: 0, opacity: 1, duration: 0.8, stagger: 0.02, ease: 'power4.out',
        })
      }
      gsap.fromTo(dividerRef.current, { scaleX: 0 }, { scaleX: 1, duration: 0.8, delay: 0.6, ease: 'power2.out' })
      gsap.fromTo(subRef.current, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.8, delay: 0.8, ease: 'power2.out' })
      gsap.fromTo(brainRef.current, { opacity: 0, scale: 0.85 }, { opacity: 1, scale: 1, duration: 1.4, delay: 0.3, ease: 'power2.out' })
      gsap.fromTo(badgeRef.current, { opacity: 0, y: 15 }, { opacity: 1, y: 0, duration: 0.6, delay: 1.2, ease: 'power2.out' })

      // Parallax brain on scroll
      gsap.to(brainRef.current, {
        yPercent: -12,
        ease: 'none',
        scrollTrigger: { trigger: heroRef.current, start: 'top top', end: 'bottom top', scrub: true },
      })
    }, heroRef)
    return () => ctx.revert()
  }, [loaded, heroRef])

  return (
    <section ref={heroRef} className="cs-hero">
      <div ref={brainRef} className="cs-hero-brain">
        <img src="/images/brain-hero.webp" alt="" className="cs-hero-brain-img" draggable="false" />
        <NeuralTracer containerRef={brainRef} />
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
            {item}<span className="cs-marquee-dot" />
          </span>
        ))}
      </div>
    </div>
  )
}

// =============================================
// Guide Line — neon scroll progress indicator
// =============================================
function GuideLine({ mainRef }) {
  const lineRef = useRef(null)
  const fillRef = useRef(null)
  const glowRef = useRef(null)

  useEffect(() => {
    if (!mainRef?.current || !lineRef.current) return
    const isMobile = window.matchMedia('(max-width: 768px)').matches
    if (isMobile) return

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: mainRef.current,
          start: 'top top',
          end: 'bottom bottom',
          scrub: 0.3,
        },
      })
      tl.fromTo(fillRef.current, { height: '0%' }, { height: '100%', ease: 'none' }, 0)
      tl.fromTo(glowRef.current, { top: '0%' }, { top: '100%', ease: 'none' }, 0)
    })
    return () => ctx.revert()
  }, [mainRef])

  return (
    <div ref={lineRef} className="cs-guide-line" aria-hidden="true">
      <div ref={fillRef} className="cs-guide-fill" />
      <div ref={glowRef} className="cs-guide-glow" />
    </div>
  )
}

// =============================================
// Vision Section
// =============================================
function VisionSection() {
  const sectionRef = useRef(null)
  const quoteRef = useRef(null)
  const bodyRef = useRef(null)
  const imgRef = useRef(null)

  useEffect(() => {
    const isMobile = window.matchMedia('(max-width: 768px)').matches
    const ctx = gsap.context(() => {
      const words = quoteRef.current?.querySelectorAll('.cs-reveal-word')
      if (words?.length) {
        // Set initial dim state
        gsap.set(words, { opacity: 0.15, color: 'rgba(255,255,255,0.5)' })

        if (!isMobile) {
          // Pinned scroll-scrubbed word-by-word neon blue reveal
          gsap.to(words, {
            opacity: 1,
            color: '#22d3ee',
            textShadow: '0 0 20px rgba(34,211,238,0.4), 0 0 40px rgba(34,211,238,0.12)',
            stagger: { each: 0.6 / words.length },
            ease: 'none',
            scrollTrigger: {
              trigger: sectionRef.current,
              start: 'top top',
              end: '+=80%',
              scrub: 0.6,
              pin: true,
              anticipatePin: 1,
              onLeave: () => {
                gsap.set(words, { opacity: 1, color: '#22d3ee', textShadow: '0 0 20px rgba(34,211,238,0.4), 0 0 40px rgba(34,211,238,0.12)' })
              },
              onRefresh: () => {
                const lenis = getLenis()
                if (lenis) lenis.resize()
              },
            },
          })
        } else {
          // Mobile: one-shot reveal fallback
          gsap.to(words, {
            opacity: 1, color: '#22d3ee', duration: 0.5, stagger: 0.03, ease: 'power2.out',
            scrollTrigger: { trigger: sectionRef.current, start: 'top 80%' },
          })
        }
      }

      // Body paragraphs — one-shot fade-in + word-by-word reading
      const paras = bodyRef.current?.querySelectorAll('p')
      if (paras?.length) {
        gsap.fromTo(paras, { opacity: 0, y: 30 }, {
          opacity: 1, y: 0, duration: 0.7, stagger: 0.2, ease: 'power2.out',
          scrollTrigger: { trigger: bodyRef.current, start: 'top 75%' },
        })

        // Word-by-word reading effect
        paras.forEach((p) => {
          const pWords = p.querySelectorAll('.cs-reveal-word')
          if (!pWords?.length) return
          gsap.set(pWords, { opacity: 0.15 })
          gsap.to(pWords, {
            opacity: 1,
            stagger: { each: 0.6 / pWords.length },
            ease: 'none',
            scrollTrigger: {
              trigger: p,
              start: 'top 70%',
              end: 'bottom 40%',
              scrub: 0.5,
            },
          })
        })

        // Staggered depth parallax (Effect #4)
        if (!isMobile) {
          paras.forEach((p, i) => {
            const yFrom = i === 0 ? 5 : 10
            const yTo = i === 0 ? -5 : -10
            gsap.fromTo(p, { yPercent: yFrom }, {
              yPercent: yTo,
              ease: 'none',
              scrollTrigger: {
                trigger: p,
                start: 'top bottom',
                end: 'bottom top',
                scrub: true,
              },
            })
          })
        }
      }

      // Section label y-parallax (Effect #3)
      const label = sectionRef.current?.querySelector('.cs-section-label')
      if (label && !isMobile) {
        gsap.to(label, {
          yPercent: -30,
          ease: 'none',
          scrollTrigger: {
            trigger: sectionRef.current,
            start: 'top bottom',
            end: 'bottom top',
            scrub: true,
          },
        })
      }

      if (imgRef.current) {
        const imgBreak = imgRef.current.parentElement
        gsap.fromTo(imgRef.current, { yPercent: -10 }, {
          yPercent: 10, ease: 'none',
          scrollTrigger: { trigger: imgBreak, start: 'top bottom', end: 'bottom top', scrub: true },
        })

        // Neon blue sweep on image break
        const neonOverlay = imgBreak?.querySelector('.cs-img-break-neon')
        if (neonOverlay) {
          gsap.fromTo(neonOverlay, { opacity: 0 }, {
            opacity: 1,
            ease: 'none',
            scrollTrigger: {
              trigger: imgBreak,
              start: 'top 70%',
              end: 'top 20%',
              scrub: 0.5,
            },
          })
          gsap.fromTo(neonOverlay, { opacity: 1 }, {
            opacity: 0,
            ease: 'none',
            scrollTrigger: {
              trigger: imgBreak,
              start: 'bottom 70%',
              end: 'bottom 30%',
              scrub: 0.5,
            },
          })
        }
      }
    }, sectionRef)

    // Refresh ScrollTrigger and Lenis after pin-spacer insertion
    ScrollTrigger.refresh()
    const lenis = getLenis()
    if (lenis) lenis.resize()

    return () => ctx.revert()
  }, [])

  return (
    <>
      <section ref={sectionRef} id="cs-vision" className="cs-vision">
        <blockquote ref={quoteRef} className="cs-vision-quote">
          <SplitWords text="The knowledge you consume already exists within reach. Most of it is lost — buried in hours of video you'll never rewatch." />
        </blockquote>
        <div ref={bodyRef} className="cs-vision-body">
          <p>
            <SplitWords text="We believe the future belongs to those who can recall what they've learned — instantly, effortlessly, and in context. Not through memorization, but through intelligent systems that work alongside your curiosity." />
          </p>
          <p>
            <SplitWords text="Cortexle transforms passive video consumption into structured, searchable intelligence. Every lecture, tutorial, and documentary becomes part of your permanent knowledge base." />
          </p>
        </div>
      </section>
      {/* Full-bleed parallax image break */}
      <div className="cs-img-break">
        <img ref={imgRef} src="/brain-neural.jpg" alt="" className="cs-img-break-src" draggable="false" />
        <div className="cs-img-break-overlay" />
        <div className="cs-img-break-neon" />
      </div>
    </>
  )
}

// =============================================
// Stats Bar
// =============================================
function StatsBar() {
  const ref = useRef(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!ref.current) return
    const ctx = gsap.context(() => {
      ScrollTrigger.create({
        trigger: ref.current, start: 'top 85%', once: true,
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
    const obj = { val: 0 }
    gsap.to(obj, {
      val: value, duration: 2, ease: 'power2.out',
      onUpdate: () => { if (numRef.current) numRef.current.textContent = Math.round(obj.val) },
    })
  }, [visible, value])

  return (
    <div className="cs-stat">
      <span className="cs-stat-num"><span ref={numRef}>0</span>{suffix}</span>
      <span className="cs-stat-label">{label}</span>
    </div>
  )
}

// =============================================
// Pillars Section
// =============================================
const PILLARS = [
  { num: '01', icon: 'eye', title: 'VISION AI', sub: 'See What Others Miss', desc: 'Captures diagrams, slides, code, and visual content directly from video frames — information that transcripts alone would never reveal.' },
  { num: '02', icon: 'brain', title: 'SMART NOTES', sub: 'Memory That Never Fades', desc: 'AI-generated summaries, key points, and structured notes that distill hours of content into actionable knowledge.' },
  { num: '03', icon: 'search', title: 'SEMANTIC SEARCH', sub: 'Find Anything, Instantly', desc: 'Search in plain English across your entire video library. Find concepts, not just keywords — even across hundreds of hours.' },
  { num: '04', icon: 'chat', title: 'AI CHAT', sub: 'Your Knowledge, Conversational', desc: 'Ask questions about any video and receive cited, contextual answers drawn from your personal knowledge base.' },
]

function PillarsSection() {
  const sectionRef = useRef(null)
  const bgTextRef = useRef(null)

  useEffect(() => {
    const isMobile = window.matchMedia('(max-width: 768px)').matches
    const ctx = gsap.context(() => {
      const cards = sectionRef.current?.querySelectorAll('.cs-pillar')
      if (cards?.length) {
        // Scroll-scrubbed one-at-a-time card reveal
        cards.forEach(card => {
          gsap.fromTo(card, { opacity: 0, y: 60, scale: 0.96 }, {
            opacity: 1, y: 0, scale: 1,
            ease: 'power3.out',
            scrollTrigger: {
              trigger: card,
              start: 'top 90%',
              end: 'top 55%',
              scrub: 0.5,
            },
          })

          // Border glow neon blue as card scrolls into view
          gsap.fromTo(card,
            { borderColor: 'rgba(255,255,255,0.05)', boxShadow: '0 0 0 rgba(34,211,238,0)' },
            {
              borderColor: 'rgba(34,211,238,0.3)',
              boxShadow: '0 0 15px rgba(34,211,238,0.06), inset 0 0 15px rgba(34,211,238,0.03)',
              ease: 'none',
              scrollTrigger: {
                trigger: card,
                start: 'top 75%',
                end: 'bottom 30%',
                scrub: 0.5,
              },
            }
          )

          // Number highlights neon blue
          const num = card.querySelector('.cs-pillar-num')
          if (num) {
            gsap.fromTo(num,
              { color: 'rgba(255,255,255,0.07)' },
              {
                color: 'rgba(34,211,238,0.35)',
                textShadow: '0 0 30px rgba(34,211,238,0.15)',
                ease: 'none',
                scrollTrigger: {
                  trigger: card,
                  start: 'top 80%',
                  end: 'top 50%',
                  scrub: 0.5,
                },
              }
            )
          }

          // Word-by-word reading on descriptions
          const cWords = card.querySelectorAll('.cs-pillar-desc .cs-reveal-word')
          if (cWords?.length) {
            gsap.set(cWords, { opacity: 0.15 })
            gsap.to(cWords, {
              opacity: 1,
              stagger: { each: 0.5 / cWords.length },
              ease: 'none',
              scrollTrigger: {
                trigger: card,
                start: 'top 65%',
                end: 'bottom 40%',
                scrub: 0.5,
              },
            })
          }
        })
      }

      // Section label y-parallax (Effect #3)
      const label = sectionRef.current?.querySelector('.cs-section-label')
      if (label && !isMobile) {
        gsap.to(label, {
          yPercent: -30,
          ease: 'none',
          scrollTrigger: {
            trigger: sectionRef.current,
            start: 'top bottom',
            end: 'bottom top',
            scrub: true,
          },
        })
      }

      // Background "CORTEXLE" watermark horizontal scrub (Effect #5)
      if (bgTextRef.current && !isMobile) {
        gsap.fromTo(bgTextRef.current, { xPercent: -15 }, {
          xPercent: 15,
          ease: 'none',
          scrollTrigger: {
            trigger: sectionRef.current,
            start: 'top bottom',
            end: 'bottom top',
            scrub: true,
          },
        })
      }
    }, sectionRef)
    return () => ctx.revert()
  }, [])

  return (
    <section ref={sectionRef} id="cs-pillars" className="cs-pillars cs-bg-text-wrap">
      <span ref={bgTextRef} className="cs-bg-text" aria-hidden="true">CORTEXLE</span>
      <p className="cs-section-label">THE CORTEXLE FRAMEWORK</p>
      <div className="cs-pillars-grid">
        {PILLARS.map((p) => (
          <div key={p.num} className="cs-pillar">
            <div className="cs-pillar-header">
              <span className="cs-pillar-num">{p.num}</span>
              <span className="cs-pillar-icon">{ICONS[p.icon]}</span>
            </div>
            <h3 className="cs-pillar-title">{p.title}</h3>
            <p className="cs-pillar-sub">{p.sub}</p>
            <p className="cs-pillar-desc"><SplitWords text={p.desc} /></p>
            <div className="cs-pillar-glow" />
          </div>
        ))}
      </div>
    </section>
  )
}

// =============================================
// Process Section
// =============================================
const STEPS = [
  { num: '01', title: 'UPLOAD', desc: 'Paste a YouTube link or upload a local video file. Any format, any length.' },
  { num: '02', title: 'PROCESS', desc: 'AI transcribes, analyzes, and extracts visual content automatically — no manual work required.' },
  { num: '03', title: 'EXTRACT', desc: 'Structured notes, key points, and searchable knowledge are generated in seconds.' },
  { num: '04', title: 'REMEMBER', desc: 'Your personal knowledge base grows with every video you process. Nothing is ever lost.' },
]

function ProcessSection() {
  const sectionRef = useRef(null)
  const imgRef = useRef(null)

  useEffect(() => {
    const isMobile = window.matchMedia('(max-width: 768px)').matches
    const ctx = gsap.context(() => {
      const steps = sectionRef.current?.querySelectorAll('.cs-process-step')
      if (steps?.length) {
        steps.forEach(step => {
          // Scroll-scrubbed step reveal — one at a time
          gsap.fromTo(step, { opacity: 0, x: -30 }, {
            opacity: 1, x: 0,
            ease: 'power3.out',
            scrollTrigger: {
              trigger: step,
              start: 'top 90%',
              end: 'top 65%',
              scrub: 0.5,
            },
          })

          // Step number highlights neon blue
          const num = step.querySelector('.cs-step-num')
          if (num) {
            gsap.to(num, {
              color: '#22d3ee',
              textShadow: '0 0 12px rgba(34,211,238,0.4)',
              ease: 'none',
              scrollTrigger: {
                trigger: step,
                start: 'top 80%',
                end: 'top 55%',
                scrub: 0.5,
              },
            })
          }

          // Step title highlights neon blue
          const title = step.querySelector('.cs-step-title')
          if (title) {
            gsap.to(title, {
              color: '#22d3ee',
              textShadow: '0 0 15px rgba(34,211,238,0.3)',
              ease: 'none',
              scrollTrigger: {
                trigger: step,
                start: 'top 80%',
                end: 'top 55%',
                scrub: 0.5,
              },
            })
          }

          // Progress line fills neon blue
          const progress = step.querySelector('.cs-step-progress')
          if (progress) {
            gsap.fromTo(progress,
              { scaleX: 0 },
              {
                scaleX: 1,
                ease: 'none',
                scrollTrigger: {
                  trigger: step,
                  start: 'top 75%',
                  end: 'bottom 50%',
                  scrub: 0.5,
                },
              }
            )
          }

          // Word-by-word reading on descriptions
          const sWords = step.querySelectorAll('.cs-step-desc .cs-reveal-word')
          if (sWords?.length) {
            gsap.set(sWords, { opacity: 0.15 })
            gsap.to(sWords, {
              opacity: 1,
              stagger: { each: 0.5 / sWords.length },
              ease: 'none',
              scrollTrigger: {
                trigger: step,
                start: 'top 70%',
                end: 'bottom 50%',
                scrub: 0.5,
              },
            })
          }
        })
      }

      // Section label y-parallax (Effect #3)
      const label = sectionRef.current?.querySelector('.cs-section-label')
      if (label && !isMobile) {
        gsap.to(label, {
          yPercent: -30,
          ease: 'none',
          scrollTrigger: {
            trigger: sectionRef.current,
            start: 'top bottom',
            end: 'bottom top',
            scrub: true,
          },
        })
      }

      if (imgRef.current) {
        const imgBreak = imgRef.current.parentElement
        gsap.fromTo(imgRef.current, { yPercent: -8 }, {
          yPercent: 8, ease: 'none',
          scrollTrigger: { trigger: imgBreak, start: 'top bottom', end: 'bottom top', scrub: true },
        })

        // Neon blue sweep on image break
        const neonOverlay = imgBreak?.querySelector('.cs-img-break-neon')
        if (neonOverlay) {
          gsap.fromTo(neonOverlay, { opacity: 0 }, {
            opacity: 1,
            ease: 'none',
            scrollTrigger: {
              trigger: imgBreak,
              start: 'top 70%',
              end: 'top 20%',
              scrub: 0.5,
            },
          })
          gsap.fromTo(neonOverlay, { opacity: 1 }, {
            opacity: 0,
            ease: 'none',
            scrollTrigger: {
              trigger: imgBreak,
              start: 'bottom 70%',
              end: 'bottom 30%',
              scrub: 0.5,
            },
          })
        }
      }
    }, sectionRef)
    return () => ctx.revert()
  }, [])

  return (
    <>
      <section ref={sectionRef} id="cs-process" className="cs-process">
        <p className="cs-section-label">HOW IT WORKS</p>
        <div className="cs-process-steps">
          {STEPS.map((s) => (
            <div key={s.num} className="cs-process-step">
              <div className="cs-step-left">
                <span className="cs-step-num">{s.num}</span>
                <span className="cs-step-title">{s.title}</span>
              </div>
              <div className="cs-step-right">
                <p className="cs-step-desc"><SplitWords text={s.desc} /></p>
              </div>
              <div className="cs-step-progress" />
            </div>
          ))}
        </div>
      </section>
      {/* Second parallax image break */}
      <div className="cs-img-break cs-img-break--alt">
        <img ref={imgRef} src="/images/abstract-nodes.jpg" alt="" className="cs-img-break-src" draggable="false" />
        <div className="cs-img-break-overlay" />
        <div className="cs-img-break-neon" />
      </div>
    </>
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
  { old: 'Transcripts miss visual content', new: "Vision AI reads what's on screen" },
]

function ComparisonSection() {
  const sectionRef = useRef(null)

  useEffect(() => {
    const isMobile = window.matchMedia('(max-width: 768px)').matches
    const ctx = gsap.context(() => {
      const rows = sectionRef.current?.querySelectorAll('.cs-comp-row')
      if (rows?.length) {
        gsap.fromTo(rows, { opacity: 0, y: 20 }, {
          opacity: 1, y: 0, duration: 0.5, stagger: 0.12, ease: 'power2.out',
          scrollTrigger: { trigger: sectionRef.current, start: 'top 80%' },
        })

        // Word-by-word reading on comparison rows
        rows.forEach(row => {
          const rWords = row.querySelectorAll('.cs-reveal-word')
          if (!rWords?.length) return
          gsap.set(rWords, { opacity: 0.15 })
          gsap.to(rWords, {
            opacity: 1,
            stagger: { each: 0.4 / rWords.length },
            ease: 'none',
            scrollTrigger: {
              trigger: row,
              start: 'top 80%',
              end: 'bottom 50%',
              scrub: 0.5,
            },
          })
        })
      }

      // Section label y-parallax (Effect #3)
      const label = sectionRef.current?.querySelector('.cs-section-label')
      if (label && !isMobile) {
        gsap.to(label, {
          yPercent: -30,
          ease: 'none',
          scrollTrigger: {
            trigger: sectionRef.current,
            start: 'top bottom',
            end: 'bottom top',
            scrub: true,
          },
        })
      }
    }, sectionRef)
    return () => ctx.revert()
  }, [])

  return (
    <section ref={sectionRef} id="cs-comparison" className="cs-comparison">
      <p className="cs-section-label">A DIFFERENT APPROACH</p>
      <div className="cs-comp-header">
        <span className="cs-comp-old">THE OLD WAY</span>
        <span className="cs-comp-new">CORTEXLE</span>
      </div>
      <div className="cs-comp-grid">
        {COMPARISONS.map((c, i) => (
          <div key={i} className="cs-comp-row">
            <span className="cs-comp-old"><SplitWords text={c.old} /></span>
            <span className="cs-comp-new"><SplitWords text={c.new} /></span>
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
    const isMobile = window.matchMedia('(max-width: 768px)').matches
    const ctx = gsap.context(() => {
      const chars = sectionRef.current?.querySelectorAll('.cs-wl-heading .cs-char')
      if (chars?.length) {
        gsap.fromTo(chars, { opacity: 0, yPercent: 60 }, {
          opacity: 1, yPercent: 0,
          stagger: { each: 0.3 / chars.length },
          ease: 'power2.out',
          scrollTrigger: isMobile
            ? { trigger: sectionRef.current, start: 'top 80%' }
            : { trigger: sectionRef.current, start: 'top 85%', end: 'top 35%', scrub: 0.5 },
        })
      }
      const form = sectionRef.current?.querySelector('.cs-wl-form')
      if (form) {
        gsap.fromTo(form, { opacity: 0, y: 30 }, {
          opacity: 1, y: 0, duration: 0.7, delay: 0.3, ease: 'power2.out',
          scrollTrigger: { trigger: sectionRef.current, start: 'top 80%' },
        })
      }

      // Section label y-parallax (Effect #3)
      const label = sectionRef.current?.querySelector('.cs-section-label')
      if (label && !isMobile) {
        gsap.to(label, {
          yPercent: -30,
          ease: 'none',
          scrollTrigger: {
            trigger: sectionRef.current,
            start: 'top bottom',
            end: 'bottom top',
            scrub: true,
          },
        })
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
            onChange={(e) => { setEmail(e.target.value); setError('') }}
            disabled={submitted}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          />
          <button className="cs-wl-btn" onClick={handleSubmit} disabled={submitted}>
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
      <span className="cs-footer-links">Privacy &middot; Terms</span>
    </footer>
  )
}

// =============================================
// ComingSoonPage — Main
// =============================================
export default function ComingSoonPage() {
  const [loaded, setLoaded] = useState(false)
  const heroRef = useRef(null)
  const mainRef = useRef(null)
  useLenis()

  const handleLoaderDone = useCallback(() => setLoaded(true), [])

  return (
    <div className="cs-page">
      <FilmGrain />
      <AmbientParticles />
      <GuideLine mainRef={mainRef} />
      {!loaded && <LoadingScreen onDone={handleLoaderDone} />}
      <Navbar heroRef={heroRef} />
      <main ref={mainRef}>
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
