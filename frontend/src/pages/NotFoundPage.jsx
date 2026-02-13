import React, { useEffect } from 'react'
import { Link } from 'react-router-dom'

function NotFoundPage() {
  useEffect(() => {
    document.title = 'Page Not Found — Second Mind'
  }, [])

  return (
    <main id="main-content" className="not-found-page">
      <div className="not-found-content">
        <h1 className="not-found-code">404</h1>
        <p className="not-found-message">The page you're looking for doesn't exist or has been moved.</p>
        <Link to="/" className="not-found-link">Go back home</Link>
      </div>
    </main>
  )
}

export default NotFoundPage
