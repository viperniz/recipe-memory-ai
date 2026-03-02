import React, { useEffect, useRef, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import gsap from 'gsap'
import { Eye, Brain, Search, Wrench, FolderOpen, MessageCircle, Bell, X, Check, ChevronDown } from 'lucide-react'
import BrainIcon from '../components/icons/BrainIcon'
import { API_BASE } from '../lib/apiBase'

// =============================================
// Orb Visualization (Canvas-based 3D neural sphere)
// =============================================
function OrbVisualization({ size = 340 }) {
  const canvasRef = useRef(null)
  const animRef = useRef(null)
  const reducedMotion = useRef(
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const dpr = window.devicePixelRatio || 1
    canvas.width = size * dpr
    canvas.height = size * dpr
    ctx.scale(dpr, dpr)

    // Fibonacci sphere distribution — 60 nodes
    const NODE_COUNT = 60
    const EDGE_DIST = 0.55
    const nodes = []
    const goldenAngle = Math.PI * (3 - Math.sqrt(5))
    for (let i = 0; i < NODE_COUNT; i++) {
      const y = 1 - (i / (NODE_COUNT - 1)) * 2
      const radius = Math.sqrt(1 - y * y)
      const theta = goldenAngle * i
      nodes.push({
        x: Math.cos(theta) * radius,
        y,
        z: Math.sin(theta) * radius,
        baseSize: 1.5 + Math.random() * 1.5
      })
    }

    // Pre-compute edges (nearby node pairs)
    const edges = []
    for (let i = 0; i < NODE_COUNT; i++) {
      for (let j = i + 1; j < NODE_COUNT; j++) {
        const dx = nodes[i].x - nodes[j].x
        const dy = nodes[i].y - nodes[j].y
        const dz = nodes[i].z - nodes[j].z
        if (Math.sqrt(dx * dx + dy * dy + dz * dz) < EDGE_DIST) {
          edges.push([i, j])
        }
      }
    }

    // Particles traveling along edges
    const particles = edges.slice(0, 15).map((edge, idx) => ({
      edge,
      t: Math.random(),
      speed: 0.003 + Math.random() * 0.004,
      size: 1 + Math.random() * 1.5,
      hue: idx % 2 === 0 ? 270 : 180 // purple or cyan
    }))

    // Synaptic pulses
    const pulses = []
    let pulseTimer = 0

    const R = size * 0.38
    const cx = size / 2
    const cy = size / 2
    let angle = 0

    function project(node) {
      const cosA = Math.cos(angle)
      const sinA = Math.sin(angle)
      const rx = node.x * cosA - node.z * sinA
      const rz = node.x * sinA + node.z * cosA
      const scale = 1 / (1.8 - rz * 0.5)
      return {
        sx: cx + rx * R * scale,
        sy: cy + node.y * R * scale,
        scale,
        z: rz
      }
    }

    function draw() {
      ctx.clearRect(0, 0, size, size)

      if (!reducedMotion.current) {
        angle += 0.004
      }

      // Pulse spawner
      pulseTimer++
      if (pulseTimer > 60 && !reducedMotion.current) {
        pulseTimer = 0
        const edgeIdx = Math.floor(Math.random() * edges.length)
        pulses.push({ edge: edges[edgeIdx], t: 0, speed: 0.02, opacity: 1 })
      }

      // Project all nodes
      const projected = nodes.map(project)

      // Draw edges
      for (const [i, j] of edges) {
        const a = projected[i]
        const b = projected[j]
        const avgZ = (a.z + b.z) / 2
        const alpha = Math.max(0, 0.08 + avgZ * 0.08)
        ctx.beginPath()
        ctx.moveTo(a.sx, a.sy)
        ctx.lineTo(b.sx, b.sy)
        ctx.strokeStyle = `rgba(168, 130, 255, ${alpha})`
        ctx.lineWidth = 0.5
        ctx.stroke()
      }

      // Draw pulses
      for (let p = pulses.length - 1; p >= 0; p--) {
        const pulse = pulses[p]
        const [i, j] = pulse.edge
        const a = projected[i]
        const b = projected[j]
        const px = a.sx + (b.sx - a.sx) * pulse.t
        const py = a.sy + (b.sy - a.sy) * pulse.t
        ctx.beginPath()
        ctx.arc(px, py, 3 * pulse.opacity, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(6, 182, 212, ${pulse.opacity * 0.8})`
        ctx.fill()
        pulse.t += pulse.speed
        pulse.opacity -= 0.015
        if (pulse.t > 1 || pulse.opacity <= 0) pulses.splice(p, 1)
      }

      // Draw particles
      for (const particle of particles) {
        const [i, j] = particle.edge
        const a = projected[i]
        const b = projected[j]
        const px = a.sx + (b.sx - a.sx) * particle.t
        const py = a.sy + (b.sy - a.sy) * particle.t
        const avgZ = (a.z + b.z) / 2
        const alpha = Math.max(0, 0.3 + avgZ * 0.3)
        ctx.beginPath()
        ctx.arc(px, py, particle.size, 0, Math.PI * 2)
        ctx.fillStyle = `hsla(${particle.hue}, 80%, 70%, ${alpha})`
        ctx.fill()
        if (!reducedMotion.current) {
          particle.t += particle.speed
          if (particle.t > 1) particle.t = 0
        }
      }

      // Draw nodes
      for (const p of projected) {
        const alpha = Math.max(0, 0.3 + p.z * 0.5)
        const sz = (1.5 + p.scale) * 1.2
        // Glow
        ctx.beginPath()
        ctx.arc(p.sx, p.sy, sz * 2, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(168, 130, 255, ${alpha * 0.15})`
        ctx.fill()
        // Core
        ctx.beginPath()
        ctx.arc(p.sx, p.sy, sz, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(200, 170, 255, ${alpha})`
        ctx.fill()
      }

      animRef.current = requestAnimationFrame(draw)
    }

    draw()
    return () => cancelAnimationFrame(animRef.current)
  }, [size])

  return (
    <canvas
      ref={canvasRef}
      className="cs-orb-canvas"
      style={{ width: size, height: size }}
    />
  )
}

// =============================================
// Feature Tiles Data
// =============================================
const FEATURES = [
  {
    icon: Eye,
    label: 'Vision AI',
    color: '#f97316',
    desc: 'Captures diagrams, slides, code, and visual content from any video frame using GPT-4o vision analysis.'
  },
  {
    icon: Brain,
    label: 'Smart Notes',
    color: '#a855f7',
    desc: 'AI-generated summaries, key points, and structured breakdowns for every video you process.'
  },
  {
    icon: Search,
    label: 'Semantic Search',
    color: '#06b6d4',
    desc: 'Find anything by meaning, not just keywords. Search across your entire video knowledge library.'
  },
  {
    icon: Wrench,
    label: 'Content Tools',
    color: '#ec4899',
    desc: 'Generate flashcards, mind maps, study guides, and exportable reports from any content.'
  },
  {
    icon: FolderOpen,
    label: 'Collections',
    color: '#10b981',
    desc: 'Organize content into smart collections by topic, course, or project with AI-assisted tagging.'
  },
  {
    icon: MessageCircle,
    label: 'AI Chat',
    color: '#3b82f6',
    desc: 'Ask questions about your videos and get grounded answers with source references and timestamps.'
  }
]

// =============================================
// ComingSoonPage
// =============================================
export default function ComingSoonPage() {
  const navigate = useNavigate()
  const titleRef = useRef(null)
  const tilesRef = useRef(null)
  const [expandedTile, setExpandedTile] = useState(null)
  const [notifyOpen, setNotifyOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [notifyStatus, setNotifyStatus] = useState(null) // null | 'loading' | 'success' | 'exists' | 'error'
  const [notifyMsg, setNotifyMsg] = useState('')

  // GSAP title animation
  useEffect(() => {
    if (!titleRef.current) return
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reducedMotion) return

    const chars = titleRef.current.querySelectorAll('.cs-title-char')
    gsap.fromTo(chars,
      { opacity: 0, y: 30 },
      {
        opacity: 1,
        y: 0,
        duration: 0.5,
        stagger: 0.04,
        ease: 'back.out(1.7)',
        delay: 0.3
      }
    )
  }, [])

  // GSAP tiles stagger
  useEffect(() => {
    if (!tilesRef.current) return
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reducedMotion) return

    const tiles = tilesRef.current.querySelectorAll('.cs-tile')
    gsap.fromTo(tiles,
      { opacity: 0, y: 20 },
      {
        opacity: 1,
        y: 0,
        duration: 0.4,
        stagger: 0.08,
        ease: 'power2.out',
        delay: 0.8
      }
    )
  }, [])

  const handleTileClick = useCallback((idx) => {
    setExpandedTile(prev => prev === idx ? null : idx)
  }, [])

  const handleNotifySubmit = async (e) => {
    e.preventDefault()
    if (!email.trim()) return
    setNotifyStatus('loading')
    try {
      const res = await fetch(`${API_BASE}/waitlist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() })
      })
      const data = await res.json()
      if (!res.ok) {
        setNotifyStatus('error')
        setNotifyMsg(data.detail || 'Something went wrong')
        return
      }
      if (data.already_exists) {
        setNotifyStatus('exists')
        setNotifyMsg(data.message)
      } else {
        setNotifyStatus('success')
        setNotifyMsg(data.message)
      }
    } catch {
      setNotifyStatus('error')
      setNotifyMsg('Network error. Please try again.')
    }
  }

  const titleText = 'Coming Soon'

  return (
    <div className="cs-page">
      {/* Cosmic background */}
      <div className="cs-bg">
        <div className="landing-hero-stars" />
        <div className="landing-hero-nebula landing-hero-nebula-1" />
        <div className="landing-hero-nebula landing-hero-nebula-2" />
      </div>

      <div className="cs-layout">
        {/* Left half — brand + orb */}
        <div className="cs-left">
          <div className="cs-brand">
            <BrainIcon className="cs-brand-icon" />
            <span className="cs-brand-text">Second Mind</span>
          </div>

          <div className="cs-orb-container">
            <div className="cs-orb-glow" />
            <OrbVisualization size={340} />
            <div className="cs-orb-ring" />
          </div>
        </div>

        {/* Right half — title + tiles */}
        <div className="cs-right">
          <h1 className="cs-title" ref={titleRef}>
            {titleText.split('').map((char, i) => (
              <span key={i} className="cs-title-char">
                {char === ' ' ? '\u00A0' : char}
              </span>
            ))}
          </h1>

          <p className="cs-subtitle">
            AI-powered video knowledge management.<br />
            Watch once, remember everything.
          </p>

          <div className="cs-tiles" ref={tilesRef}>
            {FEATURES.map((feat, idx) => {
              const Icon = feat.icon
              const isExpanded = expandedTile === idx
              return (
                <button
                  key={idx}
                  className={`cs-tile ${isExpanded ? 'cs-tile-expanded' : ''}`}
                  onClick={() => handleTileClick(idx)}
                  aria-expanded={isExpanded}
                >
                  <div className="cs-tile-header">
                    <Icon size={18} style={{ color: feat.color, flexShrink: 0 }} />
                    <span className="cs-tile-label">{feat.label}</span>
                    <ChevronDown
                      size={14}
                      className={`cs-tile-chevron ${isExpanded ? 'cs-tile-chevron-open' : ''}`}
                    />
                  </div>
                  <div className="cs-tile-body" style={{ '--accent': feat.color }}>
                    <p>{feat.desc}</p>
                  </div>
                </button>
              )
            })}
          </div>

          <button
            className="cs-cta-btn"
            onClick={() => navigate('/register')}
          >
            Get Early Access
          </button>
        </div>
      </div>

      {/* Notify Me Widget */}
      <div className="cs-notify-widget">
        {!notifyOpen ? (
          <button
            className="cs-notify-fab"
            onClick={() => setNotifyOpen(true)}
            aria-label="Get notified when we launch"
          >
            <Bell size={20} />
            <span className="cs-notify-fab-label">Notify Me</span>
          </button>
        ) : (
          <div className="cs-notify-panel">
            <div className="cs-notify-panel-header">
              <span>Get Notified</span>
              <button
                className="cs-notify-close"
                onClick={() => setNotifyOpen(false)}
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>

            {notifyStatus === 'success' || notifyStatus === 'exists' ? (
              <div className="cs-notify-success">
                <Check size={24} />
                <p>{notifyMsg}</p>
              </div>
            ) : (
              <form onSubmit={handleNotifySubmit} className="cs-notify-form">
                <input
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="cs-notify-input"
                  autoFocus
                />
                <button
                  type="submit"
                  className="cs-notify-submit"
                  disabled={notifyStatus === 'loading'}
                >
                  {notifyStatus === 'loading' ? 'Sending...' : 'Notify Me'}
                </button>
                {notifyStatus === 'error' && (
                  <p className="cs-notify-error">{notifyMsg}</p>
                )}
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
