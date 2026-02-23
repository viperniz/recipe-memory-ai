import React, { useState, useEffect, useCallback } from 'react'
import YouTube from 'react-youtube'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { useYouTubePlayer } from '../../context/YouTubePlayerContext'

function extractVideoId(url) {
  if (!url) return null
  if (url.includes('v=')) return url.split('v=')[1].split('&')[0]
  if (url.includes('youtu.be/')) return url.split('youtu.be/')[1].split('?')[0]
  return null
}

function YouTubeEmbed({ sourceUrl }) {
  const [collapsed, setCollapsed] = useState(false)
  const { registerPlayer, unregisterPlayer } = useYouTubePlayer()
  const videoId = extractVideoId(sourceUrl)

  useEffect(() => {
    return () => unregisterPlayer()
  }, [unregisterPlayer])

  const onReady = useCallback((event) => {
    registerPlayer(event.target)
  }, [registerPlayer])

  if (!videoId) return null

  const opts = {
    width: '100%',
    height: '100%',
    playerVars: {
      autoplay: 0,
      modestbranding: 1,
      rel: 0,
    },
  }

  return (
    <div className="youtube-embed-container">
      <button
        className="youtube-embed-toggle"
        onClick={() => setCollapsed(!collapsed)}
      >
        {collapsed ? (
          <><ChevronDown className="w-3.5 h-3.5" /> Show player</>
        ) : (
          <><ChevronUp className="w-3.5 h-3.5" /> Hide player</>
        )}
      </button>
      {!collapsed && (
        <div className="youtube-embed-wrapper">
          <YouTube
            videoId={videoId}
            opts={opts}
            onReady={onReady}
            className="youtube-embed-iframe"
            iframeClassName="youtube-embed-iframe-inner"
          />
        </div>
      )}
    </div>
  )
}

export default YouTubeEmbed
