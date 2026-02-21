import React, { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'

function ExtensionCallbackPage() {
      const { user } = useAuth()
      const [sent, setSent] = useState(false)

    useEffect(() => {
              document.title = 'Extension Connected — Second Mind'
    }, [])

    useEffect(() => {
              const token = localStorage.getItem('token')
              console.log('[ExtensionCallback] useEffect fired', { hasToken: !!token, hasUser: !!user })

                      if (token && user) {
                                    // Send the token to the extension with retries
                  // The content script may not be ready immediately
                  const sendToken = (attempt = 1) => {
                                    console.log(`[ExtensionCallback] Sending VMEM_EXTENSION_AUTH (attempt ${attempt})`)
                                    window.postMessage({
                                                          type: 'VMEM_EXTENSION_AUTH',
                                                          token,
                                                          user: { id: user.id, email: user.email, name: user.name },
                                                          expiresIn: 2592000
                                    }, '*')
                                    setSent(true)

                                    // Retry a few times to handle timing issues with content script
                                    if (attempt < 5) {
                                                          setTimeout(() => sendToken(attempt + 1), 500)
                                    }
                  }

                  // Small delay to ensure content script is loaded
                  setTimeout(() => sendToken(), 200)
                      }
    }, [user])

    return (
              <main id="main-content" className="auth-page">
                          <div className="auth-container" style={{ textAlign: 'center' }}>
                                          <div className="auth-header">
                                                              <h1>{sent ? 'Connected!' : 'Connecting...'}</h1>
                                                              <p>
                                                                {sent
                                                                                          ? 'Your extension is now connected to Second Mind. You can close this tab.'
                                                                                          : 'Sending credentials to extension...'}
                                                              </p>
                                          </div>
                            {sent && (
                                    <p style={{ marginTop: '1rem', color: 'var(--color-text-muted)' }}>
                                                            Go to any YouTube video and click "Save to Second Mind" to get started.
                                    </p>
                                          )}
                          </div>
              </main>
          )
}

export default ExtensionCallbackPage
