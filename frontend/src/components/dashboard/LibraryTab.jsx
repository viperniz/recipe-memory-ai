import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { Download, GraduationCap, Video, Users, LayoutGrid, Search, Filter, StickyNote, X, Loader2 } from 'lucide-react'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import ContentCard from '../content/ContentCard'
import ProcessingCard from '../content/ProcessingCard'
import ContentSkeleton from '../content/ContentSkeleton'
import EmptyState from '../content/EmptyState'
import { useData } from '../../context/DataContext'

const MODE_FILTERS = [
  { id: 'all', name: 'All', icon: LayoutGrid },
  { id: 'learn', name: 'Tutorials', icon: GraduationCap },
  { id: 'creator', name: 'Podcasts', icon: Video },
  { id: 'meeting', name: 'Lectures', icon: Users },
  { id: 'deepdive', name: 'Deep Dives', icon: Search }
]

const CONTENT_TYPES = [
  { id: null, label: 'All types' },
  { id: 'youtube', label: 'YouTube' },
  { id: 'video', label: 'Video' },
  { id: 'web', label: 'Web' }
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
  const { searchResults, searchQuery, searchFilters, isSearching, performSearch, clearSearch } = useData()
  const [localQuery, setLocalQuery] = useState(searchQuery || '')
  const [contentTypeFilter, setContentTypeFilter] = useState(searchFilters.content_type || null)
  const [hasNotesFilter, setHasNotesFilter] = useState(searchFilters.has_notes || false)
  const [showFilters, setShowFilters] = useState(false)
  const debounceRef = useRef(null)

  // Sync local query with DataContext on mount
  useEffect(() => {
    setLocalQuery(searchQuery || '')
  }, [searchQuery])

  // Debounced search
  const triggerSearch = useCallback((query, filters) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      performSearch(query, filters)
    }, 300)
  }, [performSearch])

  // Handle search input change
  const handleSearchChange = (e) => {
    const query = e.target.value
    setLocalQuery(query)
    triggerSearch(query, { content_type: contentTypeFilter, has_notes: hasNotesFilter || null })
  }

  // Handle filter changes
  const handleContentTypeChange = (type) => {
    setContentTypeFilter(type)
    triggerSearch(localQuery, { content_type: type, has_notes: hasNotesFilter || null })
  }

  const handleHasNotesToggle = () => {
    const newVal = !hasNotesFilter
    setHasNotesFilter(newVal)
    triggerSearch(localQuery, { content_type: contentTypeFilter, has_notes: newVal || null })
  }

  const handleClearSearch = () => {
    setLocalQuery('')
    setContentTypeFilter(null)
    setHasNotesFilter(false)
    setShowFilters(false)
    clearSearch()
  }

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  // Active jobs - anything not completed, failed, or cancelled
  const activeJobs = jobs.filter(j =>
    j.status !== 'completed' && j.status !== 'failed' && j.status !== 'cancelled'
  )

  // Failed jobs
  const failedJobs = jobs.filter(j => j.status === 'failed')

  // Determine display contents: search results (if searching) or local filter
  const isUsingSearch = searchResults !== null
  const displayContents = useMemo(() => {
    if (isUsingSearch) {
      let result = searchResults
      // Apply mode filter on top of search results
      if (modeFilter !== 'all') {
        result = result.filter(c => c.mode === modeFilter || c.content_type === modeFilter)
      }
      return result
    }

    // Local filtering when no search query
    let result = contents
    if (modeFilter !== 'all') {
      result = result.filter(c => c.mode === modeFilter || c.content_type === modeFilter)
    }
    return result
  }, [contents, searchResults, isUsingSearch, modeFilter])

  const hasContent = contents.length > 0 || activeJobs.length > 0
  const hasActiveFilters = localQuery || contentTypeFilter || hasNotesFilter

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
            {isSearching ? (
              <Loader2 className="library-search-icon animate-spin" />
            ) : (
              <Search className="library-search-icon" />
            )}
            <Input
              type="text"
              placeholder="Search by meaning — try 'how to cook pasta' or 'machine learning basics'..."
              value={localQuery}
              onChange={handleSearchChange}
              className="library-search-input"
            />
            {hasActiveFilters && (
              <button className="library-search-clear" onClick={handleClearSearch} title="Clear search">
                <X className="w-4 h-4" />
              </button>
            )}
            <button
              className={`library-filter-toggle ${showFilters ? 'active' : ''}`}
              onClick={() => setShowFilters(!showFilters)}
              title="Toggle filters"
            >
              <Filter className="w-4 h-4" />
            </button>
          </div>

          {/* Filter chips row */}
          {showFilters && (
            <div className="search-filter-chips">
              {/* Content type filter */}
              <div className="filter-chip-group">
                {CONTENT_TYPES.map(ct => (
                  <button
                    key={ct.id || 'all'}
                    className={`filter-chip ${contentTypeFilter === ct.id ? 'active' : ''}`}
                    onClick={() => handleContentTypeChange(ct.id)}
                  >
                    {ct.label}
                  </button>
                ))}
              </div>

              {/* Has notes toggle */}
              <button
                className={`filter-chip ${hasNotesFilter ? 'active' : ''}`}
                onClick={handleHasNotesToggle}
              >
                <StickyNote className="w-3.5 h-3.5" />
                Has notes
              </button>
            </div>
          )}

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
          {(hasActiveFilters || modeFilter !== 'all') && (
            <div className="library-results-info" aria-live="polite">
              {isSearching ? (
                'Searching...'
              ) : (
                <>
                  Showing {displayContents.length} {isUsingSearch ? 'result' : 'item'}{displayContents.length !== 1 ? 's' : ''}
                  {localQuery && ` for "${localQuery}"`}
                  {modeFilter !== 'all' && ` in ${MODE_FILTERS.find(f => f.id === modeFilter)?.name}`}
                  {isUsingSearch && ' (semantic search)'}
                </>
              )}
            </div>
          )}

          <div className="library-grid" aria-live="polite">
            {/* Processing cards first (only show on 'all' filter with no search) */}
            {modeFilter === 'all' && !isUsingSearch && activeJobs.map((job) => (
              <ProcessingCard
                key={job.id}
                job={job}
                onCancel={onCancelJob}
                onRetry={onRetryJob}
                onDismiss={onDismissJob}
              />
            ))}

            {/* Failed jobs (only show on 'all' filter with no search) */}
            {modeFilter === 'all' && !isUsingSearch && failedJobs.map((job) => (
              <ProcessingCard
                key={job.id}
                job={job}
                onCancel={onCancelJob}
                onRetry={onRetryJob}
                onDismiss={onDismissJob}
              />
            ))}

            {/* Filtered content */}
            {displayContents.map((content) => (
              <ContentCard
                key={content.id}
                content={content}
                onClick={() => onCardClick(content.id)}
                onDelete={onDeleteContent}
                onAddToCollection={onAddToCollection}
              />
            ))}

            {/* Empty state for filtered view */}
            {displayContents.length === 0 && (modeFilter !== 'all' || hasActiveFilters) && !isSearching && (
              <div className="filter-empty-state">
                <p>
                  {localQuery
                    ? `No results for "${localQuery}"`
                    : `No ${MODE_FILTERS.find(f => f.id === modeFilter)?.name.toLowerCase()} content yet.`
                  }
                </p>
                <Button variant="ghost" onClick={handleClearSearch}>
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
