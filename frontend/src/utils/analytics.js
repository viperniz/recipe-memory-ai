/**
 * Google Analytics 4 utility for Second Mind.
 * All functions no-op when VITE_GA_MEASUREMENT_ID is not set.
 */

const GA_ID = import.meta.env.VITE_GA_MEASUREMENT_ID

let initialized = false

export function initGA() {
  if (!GA_ID || initialized) return
  initialized = true

  // Inject gtag.js script
  const script = document.createElement('script')
  script.async = true
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`
  document.head.appendChild(script)

  window.dataLayer = window.dataLayer || []
  window.gtag = function () {
    window.dataLayer.push(arguments)
  }
  window.gtag('js', new Date())
  window.gtag('config', GA_ID, { send_page_view: false })
}

export function trackPageView(path, title) {
  if (!GA_ID) return
  window.gtag?.('event', 'page_view', {
    page_path: path,
    page_title: title,
  })
}

export function trackEvent(name, params) {
  if (!GA_ID) return
  window.gtag?.('event', name, params)
}

export function setUserId(id) {
  if (!GA_ID) return
  window.gtag?.('set', { user_id: id })
}

export function setUserProperties(props) {
  if (!GA_ID) return
  window.gtag?.('set', 'user_properties', props)
}
