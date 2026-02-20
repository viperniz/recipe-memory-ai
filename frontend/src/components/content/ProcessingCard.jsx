import React from 'react'
import { Loader2, Video, AlertCircle, CheckCircle, X, RotateCcw, Trash2 } from 'lucide-react'
import { Progress } from '../ui/progress'
import { Button } from '../ui/button'

function ProcessingCard({ job, onClick, onCancel, onRetry, onDismiss }) {
  const isFailed = job.status === 'failed'
  const isCompleted = job.status === 'completed'
  const isCancelled = job.status === 'cancelled'
  const isInProgress = !isFailed && !isCompleted && !isCancelled

  // Extract title from URL or use provided title
  const getTitle = () => {
    if (job.title) return job.title
    try {
      const url = new URL(job.video_url)
      if (url.hostname.includes('youtube')) {
        return 'YouTube Video'
      }
      return url.pathname.split('/').pop() || 'Video'
    } catch {
      return job.video_url?.slice(0, 30) || 'Processing...'
    }
  }

  const getStatusText = () => {
    if (isFailed) return job.error || 'Processing failed'
    if (isCompleted) return 'Ready'
    if (isCancelled) return 'Cancelled'

    // Show the actual status with progress
    const progress = Math.round(job.progress || 0)
    const statusMap = {
      'queued': 'Waiting in queue...',
      'downloading': `Downloading... ${progress}%`,
      'transcribing': `Transcribing... ${progress}%`,
      'analyzing': `Analyzing... ${progress}%`,
      'processing': `Processing... ${progress}%`,
    }
    return statusMap[job.status] || `${job.status}... ${progress}%`
  }

  // CSS class for styling
  const getStatusClass = () => {
    if (isFailed) return 'failed'
    if (isCompleted) return 'completed'
    if (job.status === 'queued') return 'queued'
    return 'processing' // All other statuses use processing style
  }

  return (
    <div
      className={`processing-card ${getStatusClass()}`}
      onClick={onClick}
    >
      {/* Thumbnail placeholder */}
      <div className="processing-card-thumbnail">
        <Video className="w-8 h-8 text-zinc-600" />

        {/* X to cancel - top left, in progress only */}
        {isInProgress && onCancel && (
          <button
            type="button"
            className="processing-card-close"
            onClick={(e) => { e.stopPropagation(); onCancel(job) }}
            aria-label="Cancel"
          >
            <X className="w-4 h-4" />
          </button>
        )}

        {/* Progress overlay */}
        {isInProgress && (
          <div className="processing-card-overlay">
            <Loader2 className="w-6 h-6 animate-spin text-purple-400" />
          </div>
        )}

        {isFailed && (
          <div className="processing-card-overlay failed">
            <AlertCircle className="w-6 h-6 text-red-400" />
          </div>
        )}

        {isCompleted && (
          <div className="processing-card-overlay completed">
            <CheckCircle className="w-6 h-6 text-green-400" />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="processing-card-content">
        <h3 className="processing-card-title">{getTitle()}</h3>
        <p className="processing-card-status">{getStatusText()}</p>

        {/* Progress bar */}
        {isInProgress && (
          <Progress value={job.progress || 0} className="h-1 mt-2" />
        )}

        {/* Actions - only for failed (Retry / Dismiss) */}
        <div className="processing-card-actions" onClick={(e) => e.stopPropagation()}>
          {isFailed && onRetry && (
            <Button
              variant="outline"
              size="sm"
              className="processing-card-btn retry"
              onClick={(e) => { e.stopPropagation(); onRetry(job) }}
            >
              <RotateCcw className="w-3.5 h-3.5 mr-1" />
              Retry
            </Button>
          )}
          {(isFailed || isCancelled) && onDismiss && (
            <Button
              variant="ghost"
              size="sm"
              className="processing-card-btn dismiss"
              onClick={(e) => { e.stopPropagation(); onDismiss(job) }}
            >
              <Trash2 className="w-3.5 h-3.5 mr-1" />
              Dismiss
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

export default ProcessingCard
