import React from 'react'
import { Skeleton } from '../ui/skeleton'

function ContentSkeleton() {
  return (
    <div className="library-card">
      <div className="library-card-header">
        <Skeleton className="h-6 w-3/4" />
        <Skeleton className="h-6 w-16" />
      </div>
      <Skeleton className="h-16 w-full mt-3" />
      <div className="flex gap-2 mt-3">
        <Skeleton className="h-6 w-16" />
        <Skeleton className="h-6 w-20" />
        <Skeleton className="h-6 w-14" />
      </div>
      <Skeleton className="h-4 w-24 mt-4" />
    </div>
  )
}

export default ContentSkeleton
