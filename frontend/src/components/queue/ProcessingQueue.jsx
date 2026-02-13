import React from 'react'
import { Progress } from '../ui/progress'

function ProcessingQueue({ jobs }) {
  const activeJobs = jobs.filter(j => j.status !== 'complete' && j.status !== 'error')

  return (
    <div className="sidebar-section">
      <div className="sidebar-section-title">
        Processing Queue
        {activeJobs.length > 0 && (
          <span className="queue-badge">{activeJobs.length}</span>
        )}
      </div>
      {activeJobs.length === 0 ? (
        <div className="queue-empty">No active jobs</div>
      ) : (
        <div className="sidebar-queue-list">
          {activeJobs.map(job => (
            <div key={job.id} className="sidebar-queue-item">
              <div className="sidebar-queue-title" title={job.title}>
                {job.title.length > 30 ? job.title.substring(0, 30) + '...' : job.title}
              </div>
              <div className="sidebar-queue-status">{job.status} - {job.progress}%</div>
              <Progress value={job.progress} className="h-1" />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default ProcessingQueue
