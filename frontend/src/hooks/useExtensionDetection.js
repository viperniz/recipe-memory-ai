import { useState, useEffect, useCallback } from 'react'

/**
   * Hook to detect whether the Video Memory AI Chrome extension is installed.
   * Sends a VMEM_PING via window.postMessage and listens for VMEM_PONG.
   * 500ms timeout — if no response, assumes extension is not installed.
   */
export function useExtensionDetection() {
    const [detected, setDetected] = useState(false)
    const [loading, setLoading] = useState(true)

  useEffect(() => {
        let timeout
        const handler = (event) => {
                if (event.source !== window) return
                if (event.data?.type === 'VMEM_PONG') {
                          setDetected(true)
                          setLoading(false)
                          clearTimeout(timeout)
                }
        }

                window.addEventListener('message', handler)
        window.postMessage({ type: 'VMEM_PING' }, window.location.origin)

                timeout = setTimeout(() => {
                        setLoading(false)
                }, 500)

                return () => {
                        window.removeEventListener('message', handler)
                        clearTimeout(timeout)
                }
  }, [])

  return { detected, loading }
}

/**
 * Hook to check whether YouTube cookies are available via the extension.
 * Runs automatically once the extension is detected.
 * Returns { cookiesReady, cookiesLoading, recheckCookies }.
 *
 * cookiesReady = true  → user is logged into YouTube, cookies are available
 * cookiesReady = false → no cookies (user not logged into YouTube)
 * cookiesLoading = true → still checking
 * recheckCookies() → manually re-check (e.g. after user logs into YouTube)
 */
export function useCookieReadiness(extensionDetected) {
    const [cookiesReady, setCookiesReady] = useState(false)
    const [cookiesLoading, setCookiesLoading] = useState(false)

  const checkCookies = useCallback(async () => {
        if (!extensionDetected) {
                setCookiesReady(false)
                return
        }

                                       setCookiesLoading(true)
        try {
                const { cookies } = await requestExtensionCookies()
                setCookiesReady(!!cookies)
        } catch {
                setCookiesReady(false)
        } finally {
                setCookiesLoading(false)
        }
  }, [extensionDetected])

  // Auto-check when extension becomes detected
  useEffect(() => {
        if (extensionDetected) {
                checkCookies()
        }
  }, [extensionDetected, checkCookies])

  return { cookiesReady, cookiesLoading, recheckCookies: checkCookies }
}

/**
 * Request YouTube cookies from the extension.
 * Sends VMEM_REQUEST_COOKIES and waits for VMEM_COOKIES_RESPONSE.
 * 5s timeout.
 * @returns {Promise<{ cookies: string|null, error: string|null }>}
 */
export function requestExtensionCookies() {
    return new Promise((resolve) => {
          let timeout

                           const handler = (event) => {
                                   if (event.source !== window) return
                                   if (event.data?.type === 'VMEM_COOKIES_RESPONSE') {
                                             window.removeEventListener('message', handler)
                                             clearTimeout(timeout)
                                             resolve({
                                                         cookies: event.data.cookies,
                                                         error: event.data.error
                                             })
                                   }
                           }

                           window.addEventListener('message', handler)
          window.postMessage({ type: 'VMEM_REQUEST_COOKIES' }, window.location.origin)

                           timeout = setTimeout(() => {
                                   window.removeEventListener('message', handler)
                                   resolve({ cookies: null, error: 'Extension did not respond in time' })
                           }, 5000)
    })
}
