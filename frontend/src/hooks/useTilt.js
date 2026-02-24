import { useEffect } from 'react'

/**
 * 3D perspective tilt on hover for [data-tilt] elements.
 * Skips on touch devices. Re-runs when deps change.
 */
export function useTilt(containerRef, deps = [], options = {}) {
  const { maxRotation = 5, perspective = 800 } = options

  useEffect(() => {
    // Skip on touch-only devices
    if (window.matchMedia('(hover: none)').matches) return

    const container = containerRef.current
    if (!container) return

    const elements = container.querySelectorAll('[data-tilt]')
    if (elements.length === 0) return

    const handlers = []

    elements.forEach((el) => {
      const onMove = (e) => {
        const rect = el.getBoundingClientRect()
        const centerX = rect.left + rect.width / 2
        const centerY = rect.top + rect.height / 2
        // Normalized -1 to 1
        const nx = (e.clientX - centerX) / (rect.width / 2)
        const ny = (e.clientY - centerY) / (rect.height / 2)
        const rotateX = -ny * maxRotation
        const rotateY = nx * maxRotation
        el.style.transform = `perspective(${perspective}px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.02,1.02,1.02)`
      }

      const onLeave = () => {
        el.style.transform = ''
      }

      el.addEventListener('mousemove', onMove)
      el.addEventListener('mouseleave', onLeave)
      handlers.push({ el, onMove, onLeave })
    })

    return () => {
      handlers.forEach(({ el, onMove, onLeave }) => {
        el.removeEventListener('mousemove', onMove)
        el.removeEventListener('mouseleave', onLeave)
        el.style.transform = ''
      })
    }
  }, [containerRef, maxRotation, perspective, ...deps]) // eslint-disable-line react-hooks/exhaustive-deps
}
