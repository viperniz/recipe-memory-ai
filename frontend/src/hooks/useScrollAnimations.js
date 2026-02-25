import { useEffect } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

const ANIMATION_MAP = {
  up:    { y: 40, x: 0 },
  down:  { y: -40, x: 0 },
  left:  { y: 0, x: -40 },
  right: { y: 0, x: 40 },
  fade:  { y: 0, x: 0 },
  scale: { y: 0, x: 0, scale: 0.95 },
}

export default function useScrollAnimations(containerRef) {
  useEffect(() => {
    const container = containerRef?.current || document
    if (!container) return

    // Small delay to let Lenis fully initialize and DOM settle
    const timer = setTimeout(() => {
      const ctx = gsap.context(() => {
        // Individual animated elements
        const singles = container.querySelectorAll('[data-animate]')
        singles.forEach((el) => {
          const type = el.getAttribute('data-animate') || 'up'
          const delay = parseFloat(el.getAttribute('data-animate-delay') || '0')
          const preset = ANIMATION_MAP[type] || ANIMATION_MAP.up

          const fromVars = { ...preset, opacity: 0 }
          const toVars = {
            x: 0, y: 0, opacity: 1, scale: 1,
            duration: 0.8,
            delay,
            ease: 'power3.out',
            scrollTrigger: {
              trigger: el,
              start: 'top 90%',
              toggleActions: 'play none none none',
            },
          }

          gsap.fromTo(el, fromVars, toVars)
        })

        // Stagger groups
        const groups = container.querySelectorAll('[data-stagger]')
        groups.forEach((group) => {
          const type = group.getAttribute('data-stagger') || 'up'
          const preset = ANIMATION_MAP[type] || ANIMATION_MAP.up
          const items = group.querySelectorAll('[data-stagger-item]')

          if (items.length === 0) return

          const fromVars = { ...preset, opacity: 0 }
          const toVars = {
            x: 0, y: 0, opacity: 1, scale: 1,
            duration: 0.8,
            stagger: 0.12,
            ease: 'power3.out',
            scrollTrigger: {
              trigger: group,
              start: 'top 90%',
              toggleActions: 'play none none none',
            },
          }

          gsap.fromTo(items, fromVars, toVars)
        })
      }, container)

      // Force ScrollTrigger to recalculate after setup
      ScrollTrigger.refresh()

      // Safety: refresh again after a beat in case Lenis scroll position settled
      requestAnimationFrame(() => {
        ScrollTrigger.refresh()
      })

      // Store ctx for cleanup
      container._gsapCtx = ctx
    }, 100)

    return () => {
      clearTimeout(timer)
      if (container._gsapCtx) {
        container._gsapCtx.revert()
        delete container._gsapCtx
      }
    }
  }, [containerRef])
}
