import { useEffect } from 'react'

/**
 * IntersectionObserver reveal system scoped to a scroll container (e.g. modal).
 * Observes all [data-reveal]:not(.revealed) elements inside the container,
 * adds .revealed class with staggered delay when they enter the viewport.
 */
export function useScrollReveal(scrollContainerRef, deps = []) {
  useEffect(() => {
    const container = scrollContainerRef.current
    if (!container) return

    let observer = null

    const setup = () => {
      if (observer) observer.disconnect()

      const targets = container.querySelectorAll('[data-reveal]:not(.revealed)')
      if (targets.length === 0) return

      observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              const el = entry.target
              const delay = parseInt(el.getAttribute('data-reveal-delay') || '0', 10)
              el.style.transitionDelay = `${delay * 80}ms`
              el.classList.add('revealed')
              observer.unobserve(el)
            }
          })
        },
        {
          root: container,
          threshold: 0.1,
          rootMargin: '0px 0px -60px 0px',
        }
      )

      targets.forEach((el) => observer.observe(el))
    }

    // Delay to let React render new DOM after tab/content changes
    const timer = setTimeout(setup, 50)

    return () => {
      clearTimeout(timer)
      if (observer) observer.disconnect()
    }
  }, [scrollContainerRef, ...deps]) // eslint-disable-line react-hooks/exhaustive-deps
}
