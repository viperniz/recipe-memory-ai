import React, { useEffect, useRef, useState, useCallback } from 'react'
import { API_BASE } from '../lib/apiBase'
import brainVideo from '../video/Rotating_Brain_Video_Generated.mp4'

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
  const inputRef = useRef(null)

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

      {/* Layer 1: Rotating brain video (left half) */}
      <div className="cs-brain-wrap">
        <div className="cs-brain-glow" />
        <video
          className="cs-brain-video"
          src={brainVideo}
          autoPlay
          loop
          muted
          playsInline
        />
      </div>

      {/* Layer 2: Logo */}
      <div className="cs-logo">
        <svg viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="22" cy="22" r="20" stroke="rgba(120,180,255,0.7)" strokeWidth="1.5" />
          <circle cx="22" cy="22" r="14" stroke="rgba(120,180,255,0.5)" strokeWidth="1.2" />
          <circle cx="22" cy="22" r="8" stroke="rgba(120,180,255,0.35)" strokeWidth="1" />
          <circle cx="22" cy="22" r="3" fill="rgba(160,210,255,0.8)" />
        </svg>
        <span className="cs-logo-text">Cortexle</span>
      </div>

      {/* Layer 2: Social icons */}
      <div className="cs-socials">
        <a href="#" aria-label="Facebook">
          <svg viewBox="0 0 24 24"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" /></svg>
        </a>
        <a href="#" aria-label="Twitter">
          <svg viewBox="0 0 24 24"><path d="M23 3a10.9 10.9 0 0 1-3.14 1.53A4.48 4.48 0 0 0 22.43.36a9 9 0 0 1-2.88 1.1A4.52 4.52 0 0 0 16.11 0c-2.5 0-4.52 2.02-4.52 4.52 0 .35.04.7.11 1.03C7.69 5.37 4.07 3.58 1.64.9A4.52 4.52 0 0 0 1 3.17c0 1.57.8 2.95 2.01 3.76a4.49 4.49 0 0 1-2.05-.57v.06c0 2.19 1.56 4.01 3.63 4.43a4.56 4.56 0 0 1-2.04.08 4.52 4.52 0 0 0 4.22 3.14A9.06 9.06 0 0 1 1 16.54 12.77 12.77 0 0 0 7.29 18.5c8.23 0 12.73-6.82 12.73-12.73 0-.19 0-.38-.01-.57A9.1 9.1 0 0 0 22.46 3z" /></svg>
        </a>
      </div>

      {/* Layer 10: Content (right side) */}
      <div className="cs-ui">
        <div className="cs-content">
          <div className="cs-coming-soon">Coming Soon</div>

          <Countdown target="2026-09-01T00:00:00Z" />

          <div className="cs-email-row">
            <p>Enter your email to get notified about our launch</p>
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
                {submitted ? "You're in!" : 'Notify Me'}
              </button>
            </div>
            {error && <p className="cs-form-error">{error}</p>}
          </div>
        </div>
      </div>
    </div>
  )
}
