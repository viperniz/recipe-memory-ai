import React from 'react'
import { Clock } from 'lucide-react'
import { parseTimestamp, buildYouTubeTimestampUrl, formatTimestamp } from '../../lib/utils'

/**
 * Clickable timestamp pill that opens YouTube at the correct time.
 *
 * Props:
 *  - timestamp: string like "1:23", "01:23:45", or seconds
 *  - sourceUrl: the YouTube video URL (optional)
 *  - className: extra CSS classes (optional)
 */
function TimestampLink({ timestamp, sourceUrl, className = '' }) {
  const seconds = parseTimestamp(timestamp)
  if (seconds == null) return null

  const display = formatTimestamp(seconds)
  const ytUrl = buildYouTubeTimestampUrl(sourceUrl, seconds)

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
