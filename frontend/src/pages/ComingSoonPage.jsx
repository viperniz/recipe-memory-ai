import React, { useEffect, useRef, useState, useCallback } from 'react'
import { API_BASE } from '../lib/apiBase'

// =============================================
// Starfield Background (Canvas 2D)
// =============================================
function Starfield() {
  const canvasRef = useRef(null)

  useEffect(() => {
    const c = canvasRef.current
    if (!c) return
    const ctx = c.getContext('2d')
    const DPR = Math.min(window.devicePixelRatio || 1, 2)

    function resize() {
      c.width = Math.round(innerWidth * DPR)
      c.height = Math.round(innerHeight * DPR)
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0)
    }
    resize()

    const stars = []
    for (let i = 0; i < 2200; i++) {
      stars.push({
        x: Math.random() * 9999,
        y: Math.random() * 9999,
        r: Math.random() * 0.85 + 0.1,
        a: Math.random() * 0.55 + 0.08,
        fp: Math.random() * 6.283,
        fs: Math.random() * 1.4 + 0.3
      })
    }

    let interval

    function draw() {
      const now = Date.now() * 0.001
      ctx.fillStyle = '#04060f'
      ctx.fillRect(0, 0, innerWidth, innerHeight)
      for (const s of stars) {
        ctx.globalAlpha = s.a * (0.5 + 0.5 * Math.sin(now * s.fs + s.fp))
        ctx.fillStyle = '#aac8ff'
        ctx.beginPath()
        ctx.arc(s.x % innerWidth, s.y % innerHeight, s.r, 0, 6.283)
        ctx.fill()
      }
      ctx.globalAlpha = 1
    }

    draw()
    interval = setInterval(draw, 80)

    const onResize = () => { resize(); draw() }
    window.addEventListener('resize', onResize)

    return () => {
      clearInterval(interval)
      window.removeEventListener('resize', onResize)
    }
  }, [])

  return <canvas ref={canvasRef} className="cs-bg-canvas" />
}

// =============================================
// Neural Brain (Canvas 2D)
// =============================================

// Brain shape helpers
function getBrainOutline(cx, cy, w, h) {
  // Returns left and right hemisphere bezier outlines (top-down view)
  const hw = w * 0.48
  const hh = h * 0.46
  return {
    left: [
      { x: cx - 2, y: cy - hh },          // top center
      { cp1x: cx - hw * 0.6, cp1y: cy - hh * 1.05, cp2x: cx - hw * 1.08, cp2y: cy - hh * 0.55, x: cx - hw, y: cy - hh * 0.05 },
      { cp1x: cx - hw * 1.08, cp1y: cy + hh * 0.4, cp2x: cx - hw * 0.75, cp2y: cy + hh * 0.9, x: cx - hw * 0.3, y: cy + hh },
      { cp1x: cx - hw * 0.12, cp1y: cy + hh * 1.06, cp2x: cx - 3, cp2y: cy + hh * 0.85, x: cx - 2, y: cy + hh * 0.7 },
    ],
    right: [
      { x: cx + 2, y: cy - hh },
      { cp1x: cx + hw * 0.6, cp1y: cy - hh * 1.05, cp2x: cx + hw * 1.08, cp2y: cy - hh * 0.55, x: cx + hw, y: cy - hh * 0.05 },
      { cp1x: cx + hw * 1.08, cp1y: cy + hh * 0.4, cp2x: cx + hw * 0.75, cp2y: cy + hh * 0.9, x: cx + hw * 0.3, y: cy + hh },
      { cp1x: cx + hw * 0.12, cp1y: cy + hh * 1.06, cp2x: cx + 3, cp2y: cy + hh * 0.85, x: cx + 2, y: cy + hh * 0.7 },
    ]
  }
}

function isInsideBrain(px, py, cx, cy, w, h) {
  // Ellipse-based containment check for brain shape
  const dx = (px - cx) / (w * 0.47)
  const dy = (py - cy) / (h * 0.44)
  // Slightly wider at middle, narrower at top/bottom
  const squeeze = 1 + 0.15 * Math.abs(dy)
  return (dx * dx * squeeze + dy * dy) < 1
}

function drawHemisphere(ctx, pts, color) {
  ctx.beginPath()
  ctx.moveTo(pts[0].x, pts[0].y)
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i]
    ctx.bezierCurveTo(p.cp1x, p.cp1y, p.cp2x, p.cp2y, p.x, p.y)
  }
  ctx.strokeStyle = color
  ctx.lineWidth = 1.5
  ctx.stroke()
}

function NeuralBrain({ width, height, onHotspotPositions }) {
  const canvasRef = useRef(null)
  const animRef = useRef(null)
  const nodesRef = useRef(null)
  const edgesRef = useRef(null)
  const particlesRef = useRef(null)

  useEffect(() => {
    const c = canvasRef.current
    if (!c) return
    const ctx = c.getContext('2d')
    const DPR = Math.min(window.devicePixelRatio || 1, 2)

    c.width = Math.round(width * DPR)
    c.height = Math.round(height * DPR)
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0)

    const cx = width / 2
    const cy = height * 0.44
    const bw = width * 0.82
    const bh = height * 0.72

    // Generate nodes
    if (!nodesRef.current || nodesRef.current._w !== width) {
      const nodes = []
      let attempts = 0
      while (nodes.length < 200 && attempts < 5000) {
        attempts++
        const nx = cx + (Math.random() - 0.5) * bw * 0.92
        const ny = cy + (Math.random() - 0.5) * bh * 0.88
        if (isInsideBrain(nx, ny, cx, cy, bw, bh)) {
          // Denser at edges: bias toward perimeter
          const dx = (nx - cx) / (bw * 0.46)
          const dy = (ny - cy) / (bh * 0.43)
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist > 0.5 || Math.random() < 0.4) {
            nodes.push({
              x: nx, y: ny,
              r: Math.random() * 1.8 + 0.8,
              glow: Math.random() * 0.5 + 0.5,
              phase: Math.random() * Math.PI * 2,
              speed: Math.random() * 1.5 + 0.5
            })
          }
        }
      }
      nodes._w = width
      nodesRef.current = nodes
    }
    const nodes = nodesRef.current

    // Generate edges (distance threshold)
    if (!edgesRef.current || edgesRef.current._w !== width) {
      const edges = []
      const threshold = bw * 0.12
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x
          const dy = nodes[i].y - nodes[j].y
          const d = Math.sqrt(dx * dx + dy * dy)
          if (d < threshold) {
            edges.push({ a: i, b: j, d })
          }
        }
      }
      edges._w = width
      edgesRef.current = edges
    }
    const edges = edgesRef.current

    // Generate flow particles
    if (!particlesRef.current || particlesRef.current._w !== width) {
      const particles = []
      // Left hemisphere — cyan
      for (let i = 0; i < 40; i++) {
        particles.push(makeFlowParticle(cx, cy, bw, bh, 'left'))
      }
      // Right hemisphere — magenta
      for (let i = 0; i < 40; i++) {
        particles.push(makeFlowParticle(cx, cy, bw, bh, 'right'))
      }
      particles._w = width
      particlesRef.current = particles
    }
    const particles = particlesRef.current

    // Report hotspot pixel positions
    if (onHotspotPositions) {
      onHotspotPositions([
        { id: 'vision',    x: width * 0.65, y: height * 0.28, color: '#f59e0b' },
        { id: 'notes',     x: width * 0.35, y: height * 0.28, color: '#a855f7' },
        { id: 'search',    x: width * 0.28, y: height * 0.54, color: '#22d3ee' },
        { id: 'tools',     x: width * 0.72, y: height * 0.54, color: '#ec4899' },
        { id: 'collections', x: width * 0.50, y: height * 0.73, color: '#10b981' },
        { id: 'chat',      x: width * 0.50, y: height * 0.15, color: '#3b82f6' },
      ])
    }

    function animate() {
      const now = Date.now() * 0.001
      ctx.clearRect(0, 0, width, height)

      // Background glow
      const bgGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, bw * 0.55)
      bgGrad.addColorStop(0, 'rgba(30, 80, 180, 0.12)')
      bgGrad.addColorStop(0.5, 'rgba(20, 60, 140, 0.06)')
      bgGrad.addColorStop(1, 'transparent')
      ctx.fillStyle = bgGrad
      ctx.fillRect(0, 0, width, height)

      // Holographic base ellipse
      const baseY = cy + bh * 0.52
      ctx.save()
      for (let ring = 0; ring < 3; ring++) {
        const rw = bw * (0.38 + ring * 0.08)
        const rh = rw * 0.18
        ctx.beginPath()
        ctx.ellipse(cx, baseY, rw, rh, 0, 0, Math.PI * 2)
        ctx.strokeStyle = `rgba(80, 200, 255, ${0.12 - ring * 0.03})`
        ctx.lineWidth = 0.8
        ctx.stroke()
      }
      // Grid lines on base
      for (let i = -3; i <= 3; i++) {
        const gx = cx + i * bw * 0.06
        ctx.beginPath()
        ctx.moveTo(gx, baseY - bw * 0.07)
        ctx.lineTo(gx, baseY + bw * 0.07)
        ctx.strokeStyle = 'rgba(80, 200, 255, 0.05)'
        ctx.lineWidth = 0.5
        ctx.stroke()
      }
      ctx.restore()

      // Draw edges
      for (const e of edges) {
        const na = nodes[e.a]
        const nb = nodes[e.b]
        const alpha = 0.06 + 0.04 * Math.sin(now * 0.8 + e.a)
        ctx.beginPath()
        ctx.moveTo(na.x, na.y)
        ctx.lineTo(nb.x, nb.y)
        ctx.strokeStyle = `rgba(80, 180, 255, ${alpha})`
        ctx.lineWidth = 0.5
        ctx.stroke()
      }

      // Draw brain outline
      const outline = getBrainOutline(cx, cy, bw, bh)
      const outlineAlpha = 0.25 + 0.08 * Math.sin(now * 0.6)
      ctx.save()
      ctx.shadowColor = 'rgba(60, 140, 255, 0.4)'
      ctx.shadowBlur = 12
      drawHemisphere(ctx, outline.left, `rgba(80, 160, 255, ${outlineAlpha})`)
      drawHemisphere(ctx, outline.right, `rgba(80, 160, 255, ${outlineAlpha})`)
      // Central fissure
      ctx.beginPath()
      ctx.moveTo(cx, cy - bh * 0.46)
      ctx.lineTo(cx, cy + bh * 0.35)
      ctx.strokeStyle = `rgba(80, 160, 255, ${outlineAlpha * 0.6})`
      ctx.lineWidth = 1
      ctx.stroke()
      ctx.restore()

      // Draw nodes with glow
      for (const n of nodes) {
        const pulse = 0.6 + 0.4 * Math.sin(now * n.speed + n.phase)
        const alpha = n.glow * pulse

        // Orange glow halo
        const grad = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.r * 4)
        grad.addColorStop(0, `rgba(255, 180, 60, ${alpha * 0.35})`)
        grad.addColorStop(1, 'transparent')
        ctx.fillStyle = grad
        ctx.fillRect(n.x - n.r * 4, n.y - n.r * 4, n.r * 8, n.r * 8)

        // Bright center
        ctx.beginPath()
        ctx.arc(n.x, n.y, n.r * pulse, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(255, 200, 80, ${alpha})`
        ctx.fill()
      }

      // Draw flow particles
      for (const p of particles) {
        p.t += p.speed
        if (p.t > 1) {
          p.t -= 1
          p.fade = 0
        }
        p.fade = p.t < 0.1 ? p.t / 0.1 : p.t > 0.9 ? (1 - p.t) / 0.1 : 1

        const t = p.t
        const tt = 1 - t
        // Quadratic bezier
        const px = tt * tt * p.sx + 2 * tt * t * p.cpx + t * t * p.ex
        const py = tt * tt * p.sy + 2 * tt * t * p.cpy + t * t * p.ey

        ctx.beginPath()
        ctx.arc(px, py, 1.5, 0, Math.PI * 2)
        ctx.fillStyle = p.side === 'left'
          ? `rgba(80, 220, 255, ${p.fade * 0.7})`
          : `rgba(230, 80, 200, ${p.fade * 0.7})`
        ctx.fill()
      }

      animRef.current = requestAnimationFrame(animate)
    }

    animRef.current = requestAnimationFrame(animate)

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current)
    }
  }, [width, height, onHotspotPositions])

  return (
    <canvas
      ref={canvasRef}
      className="cs-brain-canvas"
      style={{ width, height }}
    />
  )
}

function makeFlowParticle(cx, cy, bw, bh, side) {
  const hw = bw * 0.35
  const hh = bh * 0.35
  const sign = side === 'left' ? -1 : 1
  const ox = cx + sign * hw * 0.45

  return {
    side,
    sx: ox + (Math.random() - 0.5) * hw * 0.6,
    sy: cy - hh * 0.5 + Math.random() * hh * 0.3,
    cpx: ox + (Math.random() - 0.5) * hw * 0.8,
    cpy: cy + (Math.random() - 0.5) * hh * 0.4,
    ex: ox + (Math.random() - 0.5) * hw * 0.6,
    ey: cy + hh * 0.3 + Math.random() * hh * 0.3,
    t: Math.random(),
    speed: 0.002 + Math.random() * 0.003,
    fade: 0
  }
}

// =============================================
// Brain Hotspots (HTML overlay)
// =============================================
const HOTSPOT_DATA = {
  vision:      { icon: '👁', name: 'VISION AI',       desc: 'Captures diagrams, slides & code from any video frame', color: '#f59e0b' },
  notes:       { icon: '📝', name: 'SMART NOTES',     desc: 'AI-generated summaries, key points & structured notes', color: '#a855f7' },
  search:      { icon: '🔍', name: 'SEMANTIC SEARCH',  desc: 'Find any concept across your entire video library', color: '#22d3ee' },
  tools:       { icon: '🛠', name: 'CONTENT TOOLS',   desc: 'Flashcards, mind maps & study guides from any video', color: '#ec4899' },
  collections: { icon: '📁', name: 'COLLECTIONS',     desc: 'Organize videos into smart, searchable collections', color: '#10b981' },
  chat:        { icon: '💬', name: 'AI CHAT',         desc: 'Ask questions about any video and get instant answers', color: '#3b82f6' },
}

function BrainHotspots({ hotspots }) {
  const [activeId, setActiveId] = useState(null)

  const handleClick = useCallback((id) => {
    setActiveId(prev => prev === id ? null : id)
  }, [])

  if (!hotspots || hotspots.length === 0) return null

  return (
    <div className="cs-hotspots-overlay">
      {hotspots.map(hs => {
        const data = HOTSPOT_DATA[hs.id]
        if (!data) return null
        const isActive = activeId === hs.id
        const isRight = hs.x > 50  // percentage-based: is this on the right side?
        // Calculate label position
        const labelSide = hs.id === 'chat' || hs.id === 'collections'
          ? 'right'
          : (hs.x / hotspots[0]?._containerW > 0.5 ? 'right' : 'left')

        return (
          <div key={hs.id}>
            {/* Pulsing dot */}
            <button
              className={`cs-hotspot-dot ${isActive ? 'cs-hotspot-active' : ''}`}
              style={{
                left: hs.x,
                top: hs.y,
                '--dot-color': data.color,
              }}
              onClick={() => handleClick(hs.id)}
              aria-label={data.name}
            />

            {/* Label with connector */}
            {isActive && (
              <div
                className={`cs-hotspot-label cs-label-${hs.id}`}
                style={{
                  '--accent': data.color,
                  left: hs.x,
                  top: hs.y,
                }}
              >
                <div className="cs-label-connector" />
                <div className="cs-label-box">
                  <div className="cs-label-header">
                    <span className="cs-label-icon">{data.icon}</span>
                    <span className="cs-label-name" style={{ color: data.color }}>{data.name}</span>
                  </div>
                  <p className="cs-label-desc">{data.desc}</p>
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
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
    { val: time.s, label: 'Secs' }
  ]

  return (
    <div className="cs-countdown">
      {blocks.map((b, i) => (
        <div key={b.label} className={`cs-cd-block ${i < blocks.length - 1 ? 'cs-cd-border' : ''}`}>
          <span className="cs-cd-num">{String(b.val).padStart(2, '0')}</span>
          <span className="cs-cd-label">{b.label}</span>
        </div>
      ))}
    </div>
  )
}

// =============================================
// ComingSoonPage
// =============================================
export default function ComingSoonPage() {
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')
  const [waitlistCount, setWaitlistCount] = useState(null)
  const [hotspots, setHotspots] = useState([])
  const [brainSize, setBrainSize] = useState({ w: 600, h: 500 })
  const inputRef = useRef(null)
  const brainContainerRef = useRef(null)

  // Fetch waitlist count
  useEffect(() => {
    fetch(`${API_BASE}/waitlist/count`)
      .then(r => r.json())
      .then(data => setWaitlistCount(data.count))
      .catch(() => {})
  }, [submitted])

  // Responsive brain sizing
  useEffect(() => {
    function measure() {
      if (brainContainerRef.current) {
        const rect = brainContainerRef.current.getBoundingClientRect()
        const w = Math.min(rect.width, 700)
        const h = Math.min(w * 0.82, 560)
        setBrainSize({ w, h })
      }
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [])

  // Convert hotspot positions to pixel offsets for the container
  const handleHotspotPositions = useCallback((positions) => {
    setHotspots(positions.map(p => ({
      ...p,
      x: p.x,
      y: p.y,
      _containerW: brainSize.w,
    })))
  }, [brainSize.w])

  const handleSubmit = useCallback(async () => {
    const val = email.trim()
    if (!val || !val.includes('@')) {
      if (inputRef.current) inputRef.current.style.borderColor = '#f87171'
      return
    }
    try {
      const res = await fetch(`${API_BASE}/waitlist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: val })
      })
      if (res.ok) {
        setSubmitted(true)
      } else {
        const data = await res.json()
        setError(data.detail || 'Something went wrong')
      }
    } catch {
      setError('Network error')
    }
  }, [email])

  return (
    <div className="cs-page">
      {/* Layer 0: Starfield */}
      <Starfield />

      {/* Main scrollable content */}
      <div className="cs-scroll">
        {/* Logo */}
        <div className="cs-logo">
          <svg viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="22" cy="22" r="20" stroke="rgba(120,180,255,0.7)" strokeWidth="1.5" />
            <circle cx="22" cy="22" r="14" stroke="rgba(120,180,255,0.5)" strokeWidth="1.2" />
            <circle cx="22" cy="22" r="8" stroke="rgba(120,180,255,0.35)" strokeWidth="1" />
            <circle cx="22" cy="22" r="3" fill="rgba(160,210,255,0.8)" />
          </svg>
          <span className="cs-logo-text">Cortexle</span>
        </div>

        {/* Hero text */}
        <div className="cs-hero-text">
          <h1 className="cs-headline">Your AI-Powered Second Brain</h1>
          <p className="cs-subline">
            Process any video. Extract knowledge.<br />Remember everything.
          </p>
        </div>

        {/* Brain visualization container */}
        <div className="cs-brain-container" ref={brainContainerRef}>
          <NeuralBrain
            width={brainSize.w}
            height={brainSize.h}
            onHotspotPositions={handleHotspotPositions}
          />
          <BrainHotspots hotspots={hotspots} />
          <div className="cs-system-status">
            <span className="cs-status-dot" />
            SYSTEM STATUS: OPERATIONAL
          </div>
        </div>

        {/* CTA email form */}
        <div className="cs-cta-section">
          <div className="cs-form-row">
            <input
              ref={inputRef}
              className="cs-email-input"
              type="email"
              placeholder="Enter your email address"
              value={email}
              onChange={e => { setEmail(e.target.value); setError(''); if (inputRef.current) inputRef.current.style.borderColor = '' }}
              disabled={submitted}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            />
            <button
              className="cs-notify-btn"
              onClick={handleSubmit}
              disabled={submitted}
              style={submitted ? { background: 'linear-gradient(135deg,#059669,#10b981)' } : undefined}
            >
              {submitted ? "You're in!" : 'Join Waitlist'}
            </button>
          </div>
          {error && <p className="cs-form-error">{error}</p>}
          {waitlistCount !== null && waitlistCount > 0 && (
            <p className="cs-waitlist-count">
              Join {waitlistCount.toLocaleString()} {waitlistCount === 1 ? 'person' : 'people'} on the waitlist
            </p>
          )}
        </div>

        {/* Countdown */}
        <div className="cs-countdown-section">
          <Countdown target="2026-09-01T00:00:00Z" />
          <p className="cs-launch-date">Launching September 2026</p>
        </div>

        {/* Footer */}
        <footer className="cs-footer">
          &copy; 2026 Cortexle &middot; Privacy &middot; Terms
        </footer>
      </div>
    </div>
  )
}
