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
    if (token && user) {
      window.postMessage({
        type: 'VMEM_EXTENSION_AUTH',
        token,
        user: { id: user.id, email: user.email, name: user.name }
      }, '*')
      setSent(true)
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
              : 'Sending credentials to extension...'
            }
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
