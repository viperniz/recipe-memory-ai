import React, { useState, useMemo } from 'react'
import { Download, GraduationCap, Video, Users, LayoutGrid, Search } from 'lucide-react'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import ContentCard from '../content/ContentCard'
import ProcessingCard from '../content/ProcessingCard'
import ContentSkeleton from '../content/ContentSkeleton'
import EmptyState from '../content/EmptyState'

const MODE_FILTERS = [
  { id: 'all', name: 'All', icon: LayoutGrid },
  { id: 'learn', name: 'Tutorials', icon: GraduationCap },
  { id: 'creator', name: 'Podcasts', icon: Video },
  { id: 'meeting', name: 'Lectures', icon: Users },
  { id: 'deepdive', name: 'Deep Dives', icon: Search }
]

function LibraryTab({
  contents,
  isLoading,
  onCardClick,
  onDeleteContent,
  onAddToCollection,
  onExportAll,
  jobs,
  onCancelJob,
  onRetryJob,
  onDismissJob,
  onNavigate
}) {
  const [modeFilter, setModeFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')

  // Active jobs - anything not completed, failed, or cancelled
  const activeJobs = jobs.filter(j =>
    j.status !== 'completed' && j.status !== 'failed' && j.status !== 'cancelled'
  )

  // Failed jobs
  const failedJobs = jobs.filter(j => j.status === 'failed')

  // Filter contents by mode and search query
  const filteredContents = useMemo(() => {
    let result = contents

    // Filter by mode
    if (modeFilter !== 'all') {
      result = result.filter(c => c.mode === modeFilter || c.content_type === modeFilter)
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      result = result.filter(c =>
        c.title?.toLowerCase().includes(query) ||
        c.summary?.toLowerCase().includes(query) ||
        c.tags?.some(t => t.toLowerCase().includes(query)) ||
        c.topics?.some(t => t.toLowerCase().includes(query))
      )
    }

    return result
  }, [contents, modeFilter, searchQuery])

  const hasContent = contents.length > 0 || activeJobs.length > 0

  // Count contents by mode
  const modeCounts = contents.reduce((acc, c) => {
    const mode = c.mode || 'general'
    acc[mode] = (acc[mode] || 0) + 1
    return acc
  }, {})

  return (
    <div className="page">
      {contents.length > 0 && (
        <div className="page-header">
          <div></div>
          <Button variant="outline" onClick={onExportAll}>
            <Download className="w-4 h-4 mr-2" />
            Export Knowledge Base
          </Button>
        </div>
      )}

      {/* Search and Filter Bar */}
      {contents.length > 0 && (
        <div className="library-filters">
          {/* Search */}
          <div className="library-search">
            <Search className="library-search-icon" />
            <Input
              type="text"
              placeholder="Search your knowledge base..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="library-search-input"
            />
          </div>

          {/* Mode Filter Tabs */}
          <div className="mode-filter-tabs">
            {MODE_FILTERS.map((filter) => {
              const Icon = filter.icon
              const count = filter.id === 'all' ? contents.length : (modeCounts[filter.id] || 0)
              const isActive = modeFilter === filter.id

              // Don't show filter if no content of that type (except 'all')
              if (filter.id !== 'all' && count === 0) return null

              return (
                <button
                  key={filter.id}
                  className={`mode-filter-tab ${isActive ? 'active' : ''}`}
                  onClick={() => setModeFilter(filter.id)}
                >
                  <Icon className="w-4 h-4" />
                  <span>{filter.name}</span>
                  <span className="mode-filter-count">{count}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {isLoading && contents.length === 0 && activeJobs.length === 0 ? (
        <div className="library-grid">
          {[...Array(6)].map((_, i) => (
            <ContentSkeleton key={i} />
          ))}
        </div>
      ) : !hasContent ? (
        <EmptyState type="library" onNavigate={onNavigate} />
      ) : (
        <>
          {/* Results info */}
          {(searchQuery || modeFilter !== 'all') && (
            <div className="library-results-info" aria-live="polite">
              Showing {filteredContents.length} of {contents.length} items
              {searchQuery && ` matching "${searchQuery}"`}
              {modeFilter !== 'all' && ` in ${MODE_FILTERS.find(f => f.id === modeFilter)?.name}`}
            </div>
          )}

          <div className="library-grid" aria-live="polite">
            {/* Processing cards first (only show on 'all' filter with no search) */}
            {modeFilter === 'all' && !searchQuery && activeJobs.map((job) => (
              <ProcessingCard
                key={job.id}
                job={job}
                onCancel={onCancelJob}
                onRetry={onRetryJob}
                onDismiss={onDismissJob}
              />
            ))}

            {/* Failed jobs (only show on 'all' filter with no search) */}
            {modeFilter === 'all' && !searchQuery && failedJobs.map((job) => (
              <ProcessingCard
                key={job.id}
                job={job}
                onCancel={onCancelJob}
                onRetry={onRetryJob}
                onDismiss={onDismissJob}
              />
            ))}

            {/* Filtered content */}
            {filteredContents.map((content) => (
              <ContentCard
                key={content.id}
                content={content}
                onClick={() => onCardClick(content.id)}
                onDelete={onDeleteContent}
                onAddToCollection={onAddToCollection}
              />
            ))}

            {/* Empty state for filtered view */}
            {filteredContents.length === 0 && (modeFilter !== 'all' || searchQuery) && (
              <div className="filter-empty-state">
                <p>
                  {searchQuery
                    ? `No results for "${searchQuery}"`
                    : `No ${MODE_FILTERS.find(f => f.id === modeFilter)?.name.toLowerCase()} content yet.`
                  }
                </p>
                <Button variant="ghost" onClick={() => { setModeFilter('all'); setSearchQuery(''); }}>
                  Clear filters
                </Button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

export default LibraryTab
