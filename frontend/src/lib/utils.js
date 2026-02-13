import { clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs))
}

/**
 * Parse a timestamp string like "1:23", "01:23", "1:23:45", or "83" (seconds)
 * into total seconds. Returns null if unparseable.
 */
export function parseTimestamp(ts) {
  if (ts == null) return null
  const str = String(ts).trim()
  if (!str) return null

  // Already a number (seconds)
  if (/^\d+(\.\d+)?$/.test(str)) return Math.floor(parseFloat(str))

  // MM:SS or H:MM:SS
  const parts = str.split(':').map(Number)
  if (parts.some(isNaN)) return null
  if (parts.length === 2) return parts[0] * 60 + parts[1]
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2]
  return null
}

/**
 * Build a YouTube URL that starts at a given timestamp (seconds).
 * Returns null if sourceUrl is not a YouTube URL.
 */
export function buildYouTubeTimestampUrl(sourceUrl, seconds) {
  if (!sourceUrl || seconds == null) return null
  try {
    const url = new URL(sourceUrl)
    const isYT = url.hostname.includes('youtube.com') || url.hostname.includes('youtu.be')
    if (!isYT) return null
    // Normalise to standard watch URL
    let videoId = url.searchParams.get('v')
    if (!videoId && url.hostname.includes('youtu.be')) {
      videoId = url.pathname.slice(1).split('/')[0]
    }
    if (!videoId) return null
    return `https://www.youtube.com/watch?v=${videoId}&t=${Math.floor(seconds)}s`
  } catch {
    return null
  }
}

/**
 * Format seconds into MM:SS or H:MM:SS string
 */
export function formatTimestamp(seconds) {
  if (seconds == null) return ''
  const s = Math.floor(seconds)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
  return `${m}:${String(sec).padStart(2, '0')}`
}
