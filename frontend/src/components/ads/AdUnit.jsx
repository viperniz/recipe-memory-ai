import React, { useEffect, useRef } from 'react'

const PUBLISHER_ID = import.meta.env.VITE_ADSENSE_PUBLISHER_ID

let scriptLoaded = false

function loadAdSenseScript() {
  if (scriptLoaded || !PUBLISHER_ID) return
  scriptLoaded = true

  const script = document.createElement('script')
  script.async = true
  script.crossOrigin = 'anonymous'
  script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${PUBLISHER_ID}`
  document.head.appendChild(script)
}

function AdUnit({ slot, format = 'auto', tier, className = '' }) {
  const adRef = useRef(null)
  const pushed = useRef(false)

  useEffect(() => {
    if (!PUBLISHER_ID || tier !== 'free') return

    loadAdSenseScript()

    if (!pushed.current && adRef.current) {
      try {
        ;(window.adsbygoogle = window.adsbygoogle || []).push({})
        pushed.current = true
      } catch (e) {
        // Ad-blocker or script not loaded yet — silently ignore
      }
    }
  }, [tier])

  if (!PUBLISHER_ID || tier !== 'free') return null

  return (
    <div className={className}>
      <ins
        className="adsbygoogle"
        style={{ display: 'block' }}
        data-ad-client={PUBLISHER_ID}
        data-ad-slot={slot}
        data-ad-format={format}
        data-full-width-responsive="true"
        ref={adRef}
      />
    </div>
  )
}

export default AdUnit
