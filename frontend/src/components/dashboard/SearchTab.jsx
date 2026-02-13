import React, { useState, useEffect, useRef } from 'react'
import { Search, Loader2, Settings2, HelpCircle, Eye } from 'lucide-react'
import { Button } from '../ui/button'

function SearchTab({
  searchQuery,
  setSearchQuery,
  searchResults,
  isSearching,
  onSearch,
  onVideoClick,
  settings,
  setSettings
}) {
  const [showSettings, setShowSettings] = useState(false)
  const [searchStatus, setSearchStatus] = useState('')
  const searchTimerRef = useRef(null)

  // Update search status message during long searches
  useEffect(() => {
    if (isSearching) {
      setSearchStatus('Searching YouTube...')
      searchTimerRef.current = setTimeout(() => {
        setSearchStatus('Still searching — this can take a few seconds...')
      }, 5000)
      const longTimer = setTimeout(() => {
        setSearchStatus('Almost there — fetching video details...')
      }, 12000)
      return () => {
        clearTimeout(searchTimerRef.current)
        clearTimeout(longTimer)
      }
    } else {
      setSearchStatus('')
    }
  }, [isSearching])

  const formatDuration = (seconds) => {
    const hrs = Math.floor(seconds / 3600)
    const mins = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const formatViews = (views) => {
    if (views >= 1000000) return `${(views / 1000000).toFixed(1)}M views`
    if (views >= 1000) return `${(views / 1000).toFixed(0)}K views`
    return `${views} views`
  }

  return (
    <div className="page">
      {/* Search Card */}
      <div className="search-card">
        <div className="search-card-body">
          <div className="search-bar">
            <div className="search-input-wrapper">
              <Search className="search-input-icon" />
              <input
                type="text"
                className="search-input-large"
                placeholder="Search for a topic, skill, or question..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !isSearching) {
                    onSearch()
                  }
                }}
                disabled={isSearching}
              />
            </div>
            <Button
              onClick={onSearch}
              disabled={isSearching}
              className="search-btn-primary"
            >
              {isSearching ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Searching...
                </>
              ) : (
                <>
                  <Search className="w-4 h-4 mr-2" />
                  Search
                </>
              )}
            </Button>
          </div>

          {/* Collapsible Advanced Options */}
          <button
            className="search-advanced-toggle"
            onClick={() => setShowSettings(!showSettings)}
          >
            <Settings2 className={`w-4 h-4 ${showSettings ? 'text-purple-400' : ''}`} />
            <span>Advanced Options</span>
            <span className={`search-advanced-chevron ${showSettings ? 'open' : ''}`}>&#9662;</span>
          </button>

          {showSettings && (
            <div className="search-settings-panel">
              <div className="search-settings-body">
                <div className="search-setting-item">
                  <label htmlFor="llm-provider">
                    LLM Provider
                    <span className="search-setting-hint" title="Choose which AI model processes your content">
                      <HelpCircle className="w-3 h-3" />
                    </span>
                  </label>
                  <select
                    id="llm-provider"
                    value={settings.provider}
                    onChange={(e) => setSettings({...settings, provider: e.target.value})}
                  >
                    <option value="openai">OpenAI (Recommended)</option>
                    <option value="ollama">Ollama (Local)</option>
                  </select>
                </div>
                <div className="search-setting-item">
                  <label>
                    <span>Vision AI</span>
                    <span className="search-setting-hint" title="Analyzes video frames for visual content like code, diagrams, and on-screen text">
                      <HelpCircle className="w-3 h-3" />
                    </span>
                  </label>
                  <div className="search-setting-toggle-row">
                    <input
                      type="checkbox"
                      checked={settings.analyzeFrames}
                      onChange={(e) => setSettings({...settings, analyzeFrames: e.target.checked})}
                    />
                    <Eye className="w-4 h-4 text-zinc-400" />
                    <span className="text-sm text-zinc-400">Analyze video frames</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Search progress feedback */}
      {isSearching && searchStatus && (
        <div className="search-status">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>{searchStatus}</span>
        </div>
      )}

      {/* Empty state with popular searches */}
      {searchResults.length === 0 && !isSearching && !searchQuery && (
        <div className="search-empty-state">
          <div className="search-empty-icon">
            <Search className="w-6 h-6" />
          </div>
          <h3>Find your next source</h3>
          <p>Search across YouTube for videos worth learning from. We'll break them down into summaries, key insights, and actionable takeaways — so you get the knowledge without rewatching.</p>
          <div className="search-suggestions">
            <span className="search-suggestions-label">Try:</span>
            {['System design fundamentals', 'Machine learning explained', 'How to write a research paper', 'JavaScript async patterns'].map((q, i) => (
              <button
                key={i}
                className="search-suggestion-chip"
                onClick={() => {
                  setSearchQuery(q)
                }}
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {searchResults.length > 0 && (
        <div className="results-info" aria-live="polite">
          Found {searchResults.length} results. Click to add to your knowledge base.
        </div>
      )}

      <div className="yt-grid" aria-live="polite">
        {searchResults.map((video, index) => (
          <div
            key={video.id}
            className="yt-card"
            onClick={() => onVideoClick(index)}
          >
            <div className="yt-thumb-container">
              <img src={video.thumbnail} alt="" className="yt-thumb" />
              <span className="yt-duration">{formatDuration(video.duration)}</span>
              <div className="yt-add-overlay">+ Add to Knowledge Base</div>
            </div>
            <div className="yt-info">
              <div className="yt-title">{video.title}</div>
              <div className="yt-channel">{video.channel}</div>
              <div className="yt-views">{formatViews(video.views)}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default SearchTab
