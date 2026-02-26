import React, { useRef, useEffect, useCallback } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { NODES, EDGES } from './brainData'

gsap.registerPlugin(ScrollTrigger)

const PARTICLE_COUNT = 35
const PULSE_CHANCE = 0.003 // chance per frame per edge to flash

function BrainVisualization() {
  const canvasRef = useRef(null)
  const containerRef = useRef(null)
  const animRef = useRef(null)
  const isVisibleRef = useRef(true)
  const particlesRef = useRef([])
  const pulsesRef = useRef([])
  const reducedMotion = useRef(false)

  // Initialize particles along random edges
  const initParticles = useCallback(() => {
    const particles = []
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      particles.push(spawnParticle())
    }
    particlesRef.current = particles
  }, [])

  useEffect(() => {
    reducedMotion.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    const ctx = canvas.getContext('2d')

    // Size canvas to container
    const resize = () => {
      const rect = container.getBoundingClientRect()
      const dpr = window.devicePixelRatio || 1
      canvas.width = rect.width * dpr
      canvas.height = rect.height * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    window.addEventListener('resize', resize)

    initParticles()

    // IntersectionObserver — pause when off-screen
    const observer = new IntersectionObserver(
      ([entry]) => { isVisibleRef.current = entry.isIntersecting },
      { threshold: 0.05 }
    )
    observer.observe(container)

    // Static draw for reduced motion
    if (reducedMotion.current) {
      drawStatic(ctx, container)
      return () => {
        window.removeEventListener('resize', resize)
        observer.disconnect()
      }
    }

    // Animation loop
    const animate = () => {
      if (!isVisibleRef.current) {
        animRef.current = requestAnimationFrame(animate)
        return
      }

      const w = container.getBoundingClientRect().width
      const h = container.getBoundingClientRect().height
      ctx.clearRect(0, 0, w, h)

      // Draw edges
      EDGES.forEach(([a, b], idx) => {
        const nA = NODES[a]
        const nB = NODES[b]
        const pulse = pulsesRef.current.find(p => p.edge === idx)
        const alpha = pulse ? 0.15 + pulse.intensity * 0.35 : 0.12
        ctx.beginPath()
        ctx.moveTo(nA.x * w, nA.y * h)
        ctx.lineTo(nB.x * w, nB.y * h)
        ctx.strokeStyle = pulse
          ? `rgba(168, 130, 255, ${alpha})`
          : `rgba(139, 92, 246, ${alpha})`
        ctx.lineWidth = pulse ? 1.5 : 0.8
        ctx.stroke()
      })

      // Draw nodes
      NODES.forEach((node) => {
        const x = node.x * w
        const y = node.y * h

        // Glow halo
        const grad = ctx.createRadialGradient(x, y, 0, x, y, 8)
        grad.addColorStop(0, 'rgba(139, 92, 246, 0.15)')
        grad.addColorStop(1, 'rgba(139, 92, 246, 0)')
        ctx.beginPath()
        ctx.arc(x, y, 8, 0, Math.PI * 2)
        ctx.fillStyle = grad
        ctx.fill()

        // Dot
        ctx.beginPath()
        ctx.arc(x, y, 1.8, 0, Math.PI * 2)
        ctx.fillStyle = 'rgba(168, 140, 255, 0.6)'
        ctx.fill()
      })

      // Update and draw particles
      particlesRef.current.forEach((p, i) => {
        p.t += p.speed
        if (p.t >= 1) {
          particlesRef.current[i] = spawnParticle()
          return
        }

        const [a, b] = EDGES[p.edge]
        const nA = NODES[a]
        const nB = NODES[b]
        const x = (nA.x + (nB.x - nA.x) * p.t) * w
        const y = (nA.y + (nB.y - nA.y) * p.t) * h

        // Particle trail glow
        const fadeAlpha = Math.sin(p.t * Math.PI) * 0.7
        const pGrad = ctx.createRadialGradient(x, y, 0, x, y, 5)
        pGrad.addColorStop(0, `rgba(100, 220, 255, ${fadeAlpha})`)
        pGrad.addColorStop(1, 'rgba(100, 220, 255, 0)')
        ctx.beginPath()
        ctx.arc(x, y, 5, 0, Math.PI * 2)
        ctx.fillStyle = pGrad
        ctx.fill()

        // Bright center
        ctx.beginPath()
        ctx.arc(x, y, 1.2, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(180, 240, 255, ${fadeAlpha})`
        ctx.fill()
      })

      // Random synaptic pulses
      EDGES.forEach((_, idx) => {
        if (Math.random() < PULSE_CHANCE) {
          pulsesRef.current.push({ edge: idx, intensity: 1 })
        }
      })
      pulsesRef.current = pulsesRef.current
        .map(p => ({ ...p, intensity: p.intensity - 0.02 }))
        .filter(p => p.intensity > 0)

      animRef.current = requestAnimationFrame(animate)
    }

    animRef.current = requestAnimationFrame(animate)

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current)
      window.removeEventListener('resize', resize)
      observer.disconnect()
    }
  }, [initParticles])

  // GSAP scroll fade — separate effect so it doesn't re-run the main animation
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const gsapCtx = gsap.context(() => {
      gsap.to(container, {
        opacity: 0,
        ease: 'none',
        scrollTrigger: {
          trigger: container.closest('.landing-hero'),
          start: 'top top',
          end: 'bottom top',
          scrub: true,
        },
      })
    })

    return () => { gsapCtx.revert() }
  }, [])

  return (
    <div ref={containerRef} className="brain-canvas-container">
      <canvas ref={canvasRef} className="brain-canvas" />
    </div>
  )
}

function spawnParticle() {
  const edge = Math.floor(Math.random() * EDGES.length)
  return {
    edge,
    t: Math.random() * 0.3, // start near beginning
    speed: 0.003 + Math.random() * 0.004,
  }
}

function drawStatic(ctx, container) {
  const w = container.getBoundingClientRect().width
  const h = container.getBoundingClientRect().height

  // Draw edges
  EDGES.forEach(([a, b]) => {
    const nA = NODES[a]
    const nB = NODES[b]
    ctx.beginPath()
    ctx.moveTo(nA.x * w, nA.y * h)
    ctx.lineTo(nB.x * w, nB.y * h)
    ctx.strokeStyle = 'rgba(139, 92, 246, 0.1)'
    ctx.lineWidth = 0.8
    ctx.stroke()
  })

  // Draw nodes
  NODES.forEach((node) => {
    ctx.beginPath()
    ctx.arc(node.x * w, node.y * h, 1.8, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(168, 140, 255, 0.4)'
    ctx.fill()
  })
}

export default BrainVisualization
