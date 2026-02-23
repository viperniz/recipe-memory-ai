import React from 'react'
import { Clock } from 'lucide-react'
import { parseTimestamp, buildYouTubeTimestampUrl, formatTimestamp } from '../../lib/utils'
import { useYouTubePlayer } from '../../context/YouTubePlayerContext'

/**
 * Clickable timestamp pill that seeks the embedded YouTube player (if available)
 * or falls back to opening YouTube in a new tab.
 *
 * Props:
 *  - timestamp: string like "1:23", "01:23:45", or seconds
 *  - sourceUrl: the YouTube video URL (optional)
 *  - className: extra CSS classes (optional)
 */
function TimestampLink({ timestamp, sourceUrl, className = '' }) {
  const player = useYouTubePlayer()
  const seconds = parseTimestamp(timestamp)
  if (seconds == null) return null

  const display = formatTimestamp(seconds)
  const ytUrl = buildYouTubeTimestampUrl(sourceUrl, seconds)

  // If embedded player is ready, render a button that seeks
  if (player?.isReady) {
    return (
      <button
        className={`timestamp-link ${className}`}
        title={`Jump to ${display}`}
        onClick={(e) => {
          e.stopPropagation()
          player.seekTo(seconds)
        }}
      >
        <Clock className="w-3 h-3" />
        {display}
      </button>
    )
  }

  // Fallback: open YouTube in a new tab
  if (ytUrl) {
    return (
      <a
        href={ytUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={`timestamp-link ${className}`}
        title={`Jump to ${display} on YouTube`}
        onClick={(e) => e.stopPropagation()}
      >
        <Clock className="w-3 h-3" />
        {display}
      </a>
    )
  }

  return (
    <span className={`timestamp-link timestamp-link-static ${className}`} title={display}>
      <Clock className="w-3 h-3" />
      {display}
    </span>
  )
}

export default TimestampLink
