import React, { useState } from 'react'
import { Trash2, Plus, Loader2 } from 'lucide-react'
import { Button } from '../ui/button'
import { Badge } from '../ui/badge'
import ContentSkeleton from '../content/ContentSkeleton'
import EmptyState from '../content/EmptyState'

function CollectionTab({
  collection,
  contents,
  isLoading,
  onCardClick,
  onRemoveFromCollection,
  onBackToLibrary,
  onAddVideo,
  isAddingVideo
}) {
  const [addUrl, setAddUrl] = useState('')

  if (!collection) return null

  const handleAdd = () => {
    if (!addUrl.trim()) return
    onAddVideo(addUrl.trim(), collection.id)
    setAddUrl('')
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleAdd()
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <div></div>
      </div>

      {/* Add Video to Collection */}
      <div className="collection-add-video">
        <input
          type="text"
          value={addUrl}
          onChange={(e) => setAddUrl(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Paste a YouTube URL to add to this collection..."
          disabled={isAddingVideo}
        />
        <Button onClick={handleAdd} disabled={!addUrl.trim() || isAddingVideo}>
          {isAddingVideo ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Plus className="w-4 h-4" />
          )}
          Add
        </Button>
      </div>

      {isLoading ? (
        <div className="library-grid">
          {[...Array(4)].map((_, i) => (
            <ContentSkeleton key={i} />
          ))}
        </div>
      ) : contents.length === 0 ? (
        <EmptyState type="collection" />
      ) : (
        <div className="library-grid">
          {contents.map((content) => (
            <div key={content.id} className="library-card">
              <div className="library-card-header">
                <h3
                  className="library-card-title"
                  onClick={() => onCardClick(content.id)}
                  style={{ cursor: 'pointer', flex: 1 }}
                >
                  {content.title || 'Untitled'}
                </h3>
                <div className="library-card-actions">
                  <Badge variant="default" className="text-xs">
                    {content.content_type || 'video'}
                  </Badge>
                  <button
                    className="library-card-delete"
                    onClick={(e) => {
                      e.stopPropagation()
                      onRemoveFromCollection(content.id)
                    }}
                    title="Remove from collection"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div onClick={() => onCardClick(content.id)} style={{ cursor: 'pointer' }}>
                {content.summary && (
                  <p className="library-card-summary">{content.summary}</p>
                )}
                {content.tags && content.tags.length > 0 && (
                  <div className="library-card-tags">
                    {content.tags.map((tag, idx) => (
                      <span key={idx} className="tag">{tag}</span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

    </div>
  )
}

export default CollectionTab
