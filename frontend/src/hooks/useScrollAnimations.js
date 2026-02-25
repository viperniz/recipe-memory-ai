import { useEffect } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

const ANIMATION_MAP = {
  up:    { y: 60, x: 0 },
  down:  { y: -60, x: 0 },
  left:  { y: 0, x: -60 },
  right: { y: 0, x: 60 },
  fade:  { y: 0, x: 0 },
  scale: { y: 0, x: 0, scale: 0.9 },
}

export default function useScrollAnimations(containerRef) {
  useEffect(() => {
    const container = containerRef?.current || document
    if (!container) return

    const ctx = gsap.context(() => {
      // Individual animated elements
      const singles = container.querySelectorAll('[data-animate]')
      singles.forEach((el) => {
        const type = el.getAttribute('data-animate') || 'up'
        const delay = parseFloat(el.getAttribute('data-animate-delay') || '0')
        const preset = ANIMATION_MAP[type] || ANIMATION_MAP.up

        gsap.from(el, {
          ...preset,
          opacity: 0,
          duration: 0.8,
          delay,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: el,
            start: 'top 85%',
            toggleActions: 'play none none none',
          },
        })
      })

      // Stagger groups
      const groups = container.querySelectorAll('[data-stagger]')
      groups.forEach((group) => {
        const type = group.getAttribute('data-stagger') || 'up'
        const preset = ANIMATION_MAP[type] || ANIMATION_MAP.up
        const items = group.querySelectorAll('[data-stagger-item]')

        if (items.length === 0) return

        gsap.from(items, {
          ...preset,
          opacity: 0,
          duration: 0.8,
          stagger: 0.15,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: group,
            start: 'top 85%',
            toggleActions: 'play none none none',
          },
        })
      })
    }, container)

    return () => ctx.revert()
  }, [containerRef])
}
