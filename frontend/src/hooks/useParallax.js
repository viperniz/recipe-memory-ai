import { useEffect } from 'react'

/**
 * Scroll-driven CSS custom properties for parallax transforms.
 * Sets --scroll-y and --scroll-progress on the container element.
 */
export function useParallax(scrollContainerRef) {
  useEffect(() => {
    const container = scrollContainerRef.current
    if (!container) return

    let rafId = null

    const onScroll = () => {
      if (rafId) return
      rafId = requestAnimationFrame(() => {
        rafId = null
        const scrollTop = container.scrollTop
        const maxScroll = container.scrollHeight - container.clientHeight
        const progress = maxScroll > 0 ? scrollTop / maxScroll : 0
        container.style.setProperty('--scroll-y', String(scrollTop))
        container.style.setProperty('--scroll-progress', String(Math.min(1, Math.max(0, progress))))
      })
    }

    container.addEventListener('scroll', onScroll, { passive: true })
    // Set initial values
    onScroll()

    return () => {
      container.removeEventListener('scroll', onScroll)
      if (rafId) cancelAnimationFrame(rafId)
    }
  }, [scrollContainerRef])
}
