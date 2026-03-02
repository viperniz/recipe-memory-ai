import React, { useEffect, useRef, useState, useCallback } from 'react'
import * as THREE from 'three'
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

    let running = true
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
      running = false
      clearInterval(interval)
      window.removeEventListener('resize', onResize)
    }
  }, [])

  return <canvas ref={canvasRef} className="cs-bg-canvas" />
}

// =============================================
// Three.js 3D Orb
// =============================================
function OrbScene() {
  const canvasRef = useRef(null)
  const svgRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const DPR = Math.min(window.devicePixelRatio || 1, 2)

    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, premultipliedAlpha: false })
    renderer.setPixelRatio(DPR)
    renderer.setSize(innerWidth, innerHeight)
    renderer.setClearColor(0x000000, 0)
    renderer.sortObjects = false

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(42, innerWidth / innerHeight, 0.1, 200)
    camera.position.set(0, 0, 6)
    camera.updateProjectionMatrix()
    camera.updateMatrixWorld()

    function getOrbCenter() {
      const fH = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.position.z
      const fW = fH * camera.aspect
      const cx = (innerWidth * 0.26 / innerWidth) * 2 - 1
      const v = new THREE.Vector3(cx, 0, 0.5).unproject(camera)
      const dir = v.sub(camera.position).normalize()
      const dist = -camera.position.z / dir.z
      const wp = camera.position.clone().addScaledVector(dir, dist)
      const R = (Math.min(innerWidth * 0.24, innerHeight * 0.38) / innerWidth) * fW * 0.47
      return { x: wp.x, y: 0, R }
    }

    let P = getOrbCenter(), OX = P.x, OY = P.y, R = P.R

    const orbGroup = new THREE.Group()
    orbGroup.position.set(OX, OY, 0)
    scene.add(orbGroup)

    // Sprite helper
    function mkSprite(sz, c0, c1, op) {
      const gc = document.createElement('canvas'); gc.width = gc.height = 256
      const c2 = gc.getContext('2d')
      const g = c2.createRadialGradient(128, 128, 0, 128, 128, 128)
      g.addColorStop(0, c0); g.addColorStop(0.3, c1)
      g.addColorStop(0.65, 'rgba(5,15,80,0.04)'); g.addColorStop(1, 'rgba(0,0,0,0)')
      c2.fillStyle = g; c2.fillRect(0, 0, 256, 256)
      const m = new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(gc), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: op })
      const s = new THREE.Sprite(m); s.scale.set(sz, sz, 1); return s
    }

    const outerH = mkSprite(R * 7, 'rgba(10,50,180,0.20)', 'rgba(6,28,140,0.07)', 0.85)
    const midV = mkSprite(R * 4, 'rgba(35,130,240,0.45)', 'rgba(15,75,210,0.14)', 0.78)
    const coreV = mkSprite(R * 2.3, 'rgba(90,190,255,0.70)', 'rgba(45,150,255,0.28)', 0.73)
    const hotC = mkSprite(R * 1.0, 'rgba(210,248,255,0.90)', 'rgba(120,225,255,0.55)', 0.86)
    orbGroup.add(outerH, midV, coreV, hotC)

    // Rim glow
    const rGc = document.createElement('canvas'); rGc.width = rGc.height = 256
    const rc = rGc.getContext('2d')
    const rg = rc.createRadialGradient(192, 128, 0, 128, 128, 128)
    rg.addColorStop(0, 'rgba(140,235,255,0.62)'); rg.addColorStop(0.28, 'rgba(45,165,255,0.22)')
    rg.addColorStop(0.65, 'rgba(12,60,180,0.04)'); rg.addColorStop(1, 'rgba(0,0,0,0)')
    rc.fillStyle = rg; rc.fillRect(0, 0, 256, 256)
    const rimM = new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(rGc), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.48 })
    const rimS = new THREE.Sprite(rimM); rimS.scale.set(R * 3.2, R * 3.2, 1)
    rimS.position.set(OX + R * 0.30, OY, 0.02); scene.add(rimS)

    // Point cloud (9000 particles)
    const N = 9000
    const ptO = new Float32Array(N * 3), ptPos = new Float32Array(N * 3)
    const ptPh = new Float32Array(N), ptSp = new Float32Array(N)
    const phi = Math.PI * (3 - Math.sqrt(5))
    for (let i = 0; i < N; i++) {
      const y = 1 - (i / (N - 1)) * 2, rr = Math.sqrt(Math.max(0, 1 - y * y)), th = phi * i
      const jt = 0.84 + Math.random() * 0.23
      ptO[i * 3] = Math.cos(th) * rr * R * jt
      ptO[i * 3 + 1] = y * R * jt
      ptO[i * 3 + 2] = Math.sin(th) * rr * R * jt
      ptPh[i] = Math.random() * 6.283
      ptSp[i] = 0.5 + Math.random() * 1.5
    }
    ptPos.set(ptO)
    const ptGeo = new THREE.BufferGeometry()
    const ptA = new THREE.BufferAttribute(ptPos, 3); ptA.setUsage(THREE.DynamicDrawUsage)
    ptGeo.setAttribute('position', ptA)

    const ptC = document.createElement('canvas'); ptC.width = ptC.height = 32
    const px2 = ptC.getContext('2d')
    const pg = px2.createRadialGradient(16, 16, 0, 16, 16, 16)
    pg.addColorStop(0, 'rgba(230,252,255,1)'); pg.addColorStop(0.28, 'rgba(90,210,255,0.85)')
    pg.addColorStop(0.65, 'rgba(30,140,255,0.22)'); pg.addColorStop(1, 'rgba(0,0,0,0)')
    px2.fillStyle = pg; px2.fillRect(0, 0, 32, 32)
    const ptMat = new THREE.PointsMaterial({ map: new THREE.CanvasTexture(ptC), size: 0.082, sizeAttenuation: true, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.90 })
    orbGroup.add(new THREE.Points(ptGeo, ptMat))

    // Geodesic arcs
    const NV = 130, verts = []
    for (let i = 0; i < NV; i++) {
      const idx = Math.floor(i * (N / NV))
      verts.push(new THREE.Vector3(ptO[idx * 3], ptO[idx * 3 + 1], ptO[idx * 3 + 2]))
    }
    for (let i = 0; i < verts.length; i++) {
      for (let j = i + 1; j < verts.length; j++) {
        if (verts[i].distanceTo(verts[j]) < R * 0.42 && Math.random() < 0.16) {
          const m2 = verts[i].clone().add(verts[j]).multiplyScalar(0.5).normalize().multiplyScalar(R * 1.03)
          const pts2 = new THREE.QuadraticBezierCurve3(verts[i], m2, verts[j]).getPoints(12)
          const g2 = new THREE.BufferGeometry().setFromPoints(pts2)
          const br = Math.random() < 0.13
          orbGroup.add(new THREE.Line(g2, new THREE.LineBasicMaterial({ color: br ? 0x88f0ff : 0x1e6ab8, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: br ? 0.60 : 0.13 })))
        }
      }
    }

    // Wisps (orbital rings)
    const wisps = []
    const wispData = [
      { tX: 0.48, tZ: 0.20, ph: 0, sp: 0.21, op: 0.38, c: 0x50d8ff },
      { tX: -0.68, tZ: 0.58, ph: 1.3, sp: 0.15, op: 0.32, c: 0x40b8ff },
      { tX: 0.82, tZ: -0.35, ph: 2.6, sp: 0.26, op: 0.26, c: 0x70e8ff },
      { tX: -0.30, tZ: -0.74, ph: 3.9, sp: 0.18, op: 0.34, c: 0x60d0ff },
      { tX: 0.22, tZ: 0.90, ph: 5.1, sp: 0.23, op: 0.24, c: 0x80daff },
      { tX: -0.92, tZ: 0.12, ph: 0.7, sp: 0.20, op: 0.22, c: 0x48c8ff },
      { tX: 0.58, tZ: -0.62, ph: 4.4, sp: 0.17, op: 0.30, c: 0x58d4ff }
    ]
    wispData.forEach(d => {
      const NW = 80, op2 = []
      for (let i = 0; i <= NW; i++) {
        const a = (i / NW) * Math.PI * 2
        const px3 = Math.cos(a) * R, py3 = Math.sin(a) * R * 0.28
        const ry3 = py3 * Math.cos(d.tX), rz3 = py3 * Math.sin(d.tX)
        const fx3 = px3 * Math.cos(d.tZ) - rz3 * Math.sin(d.tZ)
        const fz3 = px3 * Math.sin(d.tZ) + rz3 * Math.cos(d.tZ)
        op2.push(new THREE.Vector3(fx3, ry3, fz3))
      }
      const gw = new THREE.BufferGeometry().setFromPoints(op2)
      gw.attributes.position.setUsage(THREE.DynamicDrawUsage)
      wisps.push({ geo: gw, d, N: NW, o: op2.map(p => p.clone()) })
      orbGroup.add(new THREE.Line(gw, new THREE.LineBasicMaterial({ color: d.c, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: d.op })))
    })

    // Sparks
    const NS2 = 180
    const sP = new Float32Array(NS2 * 3), sV = [], sL = new Float32Array(NS2), sMx = new Float32Array(NS2)
    function rSp(i) {
      const t2 = Math.random() * Math.PI * 2, p2 = Math.acos(2 * Math.random() - 1)
      const sx = Math.sin(p2) * Math.cos(t2), sy = Math.cos(p2), sz = Math.sin(p2) * Math.sin(t2)
      sP[i * 3] = sx * R; sP[i * 3 + 1] = sy * R; sP[i * 3 + 2] = sz * R
      sV[i] = new THREE.Vector3(sx, sy, sz).multiplyScalar(0.004 + Math.random() * 0.007)
      sL[i] = 0; sMx[i] = 30 + Math.random() * 70
    }
    for (let i = 0; i < NS2; i++) { rSp(i); sL[i] = Math.random() * 50 }

    const sC2 = document.createElement('canvas'); sC2.width = sC2.height = 16
    const sX2 = sC2.getContext('2d')
    const sG2 = sX2.createRadialGradient(8, 8, 0, 8, 8, 8)
    sG2.addColorStop(0, 'rgba(245,255,255,1)'); sG2.addColorStop(0.4, 'rgba(80,228,255,0.65)'); sG2.addColorStop(1, 'rgba(0,0,0,0)')
    sX2.fillStyle = sG2; sX2.fillRect(0, 0, 16, 16)
    const sGeo = new THREE.BufferGeometry()
    const sAttr = new THREE.BufferAttribute(sP.slice(), 3); sAttr.setUsage(THREE.DynamicDrawUsage)
    sGeo.setAttribute('position', sAttr)
    const sMat = new THREE.PointsMaterial({ map: new THREE.CanvasTexture(sC2), size: 0.058, sizeAttenuation: true, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.86 })
    orbGroup.add(new THREE.Points(sGeo, sMat))

    // Hexagonal feature icons
    const HEXFEATURES = [
      { icon: 'person', label: 'Community', a: 270 },
      { icon: 'chart', label: 'Analytics', a: 330 },
      { icon: 'flask', label: 'Research', a: 30 },
      { icon: 'hand', label: 'Support', a: 90 },
      { icon: 'bars', label: 'Metrics', a: 150 },
      { icon: 'circuit', label: 'AI Core', a: 210 }
    ]

    const ICON_PATHS = {
      person: '<circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>',
      chart: '<rect x="3" y="10" width="4" height="10"/><rect x="10" y="6" width="4" height="14"/><rect x="17" y="2" width="4" height="18"/>',
      flask: '<path d="M9 3h6M9 3v8l-4 7a1 1 0 0 0 .9 1.5h12.2A1 1 0 0 0 19 18l-4-7V3"/>',
      hand: '<path d="M18 8a2 2 0 0 0-2-2h-1V5a2 2 0 0 0-4 0v1H9a2 2 0 0 0-2 2v1H5a2 2 0 0 0 0 4l3 6h8l3-6a2 2 0 0 0 0-4h-2V8z"/>',
      bars: '<line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/>',
      circuit: '<circle cx="12" cy="12" r="2"/><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>'
    }

    function hexPath(cx, cy, r) {
      const pts = []
      for (let i = 0; i < 6; i++) {
        const ang = (i * 60 - 30) * Math.PI / 180
        pts.push(`${(cx + r * Math.cos(ang)).toFixed(1)},${(cy + r * Math.sin(ang)).toFixed(1)}`)
      }
      return pts.join(' ')
    }

    const svgEl = svgRef.current
    function placeHex() {
      if (!svgEl) return
      svgEl.innerHTML = ''
      const gw2 = innerWidth * 0.52, gh = innerHeight
      const cx = gw2 * 0.5, cy = gh * 0.5
      const orb = Math.min(gw2 * 0.44, gh * 0.40)
      const hr = orb * 0.22, dist = orb * 0.72

      HEXFEATURES.forEach(f => {
        const ang = f.a * Math.PI / 180
        const hx = cx + dist * Math.cos(ang), hy = cy + dist * Math.sin(ang)

        const hex = document.createElementNS('http://www.w3.org/2000/svg', 'polygon')
        hex.setAttribute('points', hexPath(hx, hy, hr))
        hex.setAttribute('fill', 'rgba(15,35,120,0.45)')
        hex.setAttribute('stroke', 'rgba(80,180,255,0.50)')
        hex.setAttribute('stroke-width', '1.2')
        svgEl.appendChild(hex)

        const fo = document.createElementNS('http://www.w3.org/2000/svg', 'foreignObject')
        fo.setAttribute('x', (hx - hr * 0.55).toFixed(1))
        fo.setAttribute('y', (hy - hr * 0.55).toFixed(1))
        fo.setAttribute('width', (hr * 1.1).toFixed(1))
        fo.setAttribute('height', (hr * 1.1).toFixed(1))
        fo.innerHTML = `<div xmlns="http://www.w3.org/1999/xhtml" style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;"><svg viewBox="0 0 24 24" style="width:${Math.round(hr * 0.6)}px;height:${Math.round(hr * 0.6)}px;fill:none;stroke:rgba(160,230,255,0.85);stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round;">${ICON_PATHS[f.icon] || ''}</svg></div>`
        svgEl.appendChild(fo)
      })
    }

    placeHex()
    window.addEventListener('resize', placeHex)

    // Animation loop
    let rotY = 0, t = 0, animId
    function anim() {
      animId = requestAnimationFrame(anim)
      t += 0.016; rotY += 0.0026
      orbGroup.rotation.y = rotY

      // Point cloud breathing
      const pA2 = ptGeo.attributes.position.array
      for (let i = 0; i < N; i++) {
        const fl = 0.72 + 0.28 * Math.sin(t * ptSp[i] + ptPh[i])
        pA2[i * 3] = ptO[i * 3]
        pA2[i * 3 + 1] = ptO[i * 3 + 1] * fl
        pA2[i * 3 + 2] = ptO[i * 3 + 2]
      }
      ptGeo.attributes.position.needsUpdate = true

      // Wisps
      wisps.forEach((wb, ri) => {
        const wa = wb.geo.attributes.position.array
        for (let i = 0; i <= wb.N; i++) {
          const a2 = (i / wb.N) * Math.PI * 2 + t * wb.d.sp + wb.d.ph
          const na = R * 0.10
          const nx3 = Math.sin(a2 * 3.1 + t * 0.75 + ri) * na
          const ny3 = Math.sin(a2 * 2.2 + t * 0.52 + ri * 1.3) * na * 0.55
          const nz3 = Math.cos(a2 * 2.6 + t * 0.60 + ri * 0.85) * na * 0.38
          wa[i * 3] = wb.o[i].x + nx3
          wa[i * 3 + 1] = wb.o[i].y + ny3
          wa[i * 3 + 2] = wb.o[i].z + nz3
        }
        wb.geo.attributes.position.needsUpdate = true
      })

      // Sparks
      const sa = sGeo.attributes.position.array
      for (let i = 0; i < NS2; i++) {
        sL[i]++
        if (sL[i] > sMx[i]) { rSp(i); continue }
        sa[i * 3] += sV[i].x; sa[i * 3 + 1] += sV[i].y; sa[i * 3 + 2] += sV[i].z
      }
      sGeo.attributes.position.needsUpdate = true

      // Glow pulse
      const pu = 0.78 + 0.22 * Math.sin(t * 0.55)
      outerH.material.opacity = 0.68 * pu
      midV.material.opacity = 0.70 * pu
      coreV.material.opacity = 0.68 * pu
      hotC.material.opacity = 0.83 * pu
      rimS.material.opacity = 0.40 + 0.20 * Math.sin(t * 0.70 + 1.2)

      renderer.render(scene, camera)
    }
    anim()

    const onResize = () => {
      renderer.setSize(innerWidth, innerHeight)
      camera.aspect = innerWidth / innerHeight
      camera.updateProjectionMatrix()
      camera.updateMatrixWorld()
    }
    window.addEventListener('resize', onResize)

    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener('resize', onResize)
      window.removeEventListener('resize', placeHex)
      renderer.dispose()
    }
  }, [])

  return (
    <>
      <canvas ref={canvasRef} className="cs-sphere-canvas" />
      <svg ref={svgRef} className="cs-hex-svg" />
    </>
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

      {/* Layer 1: Three.js Orb + Hex icons */}
      <OrbScene />

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
