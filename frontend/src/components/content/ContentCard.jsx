import React from 'react'
import { Trash2, FolderPlus, ChefHat, GraduationCap, Video, Users } from 'lucide-react'
import { Badge } from '../ui/badge'

const MODE_CONFIG = {
  recipe: { icon: ChefHat, color: 'from-orange-500 to-red-500', label: 'Recipe' },
  learn: { icon: GraduationCap, color: 'from-blue-500 to-indigo-500', label: 'Learn' },
  creator: { icon: Video, color: 'from-purple-500 to-pink-500', label: 'Creator' },
  meeting: { icon: Users, color: 'from-green-500 to-teal-500', label: 'Meeting' }
}

function ContentCard({
  content,
  onClick,
  onDelete,
  onAddToCollection,
  showCollectionButton = true
}) {
  const mode = content.mode || 'general'
  const modeConfig = MODE_CONFIG[mode]
  const ModeIcon = modeConfig?.icon

  // Thumbnail source priority: youtube_thumbnail > blob URL > API proxy > none
  const metadata = content.metadata || {}
  const firstThumb = metadata.thumbnails?.[0]
  const cardThumbnail = metadata.youtube_thumbnail
    || (firstThumb?.url)
    || (firstThumb ? `${import.meta.env.VITE_API_URL || ''}/api/thumbnails/${content.id}/${firstThumb.filename}` : null)

  return (
    <div className={`library-card ${mode !== 'general' ? `library-card-${mode}` : ''}`}>
      {cardThumbnail && (
        <div className="library-card-thumb-wrap" onClick={onClick} style={{ cursor: 'pointer' }}>
          <img src={cardThumbnail} alt="" className="library-card-thumb" loading="lazy" />
        </div>
      )}
      <div className="library-card-header">
        <div className="library-card-title-row" onClick={onClick} style={{ cursor: 'pointer', flex: 1 }}>
          {ModeIcon && (
            <div className={`library-card-mode-icon bg-gradient-to-br ${modeConfig.color}`}>
              <ModeIcon className="w-4 h-4 text-white" />
            </div>
          )}
          <h3 className="library-card-title">
            {content.title || 'Untitled'}
          </h3>
        </div>
        <div className="library-card-actions">
          <Badge variant="default" className="text-xs">
            {content.content_type || 'video'}
          </Badge>
          {showCollectionButton && (
            <button
              className="library-card-collection"
              onClick={(e) => {
                e.stopPropagation()
                onAddToCollection(content.id)
              }}
              title="Add to collection"
            >
              <FolderPlus className="w-4 h-4" />
            </button>
          )}
          <button
            className="library-card-delete"
            onClick={(e) => {
              e.stopPropagation()
              onDelete(content.id, content.title)
            }}
            title="Delete"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
      <div onClick={onClick} style={{ cursor: 'pointer' }}>
        {content.summary && (
          <p className="library-card-summary">{content.summary}</p>
        )}

        {/* Recipe quick info */}
        {mode === 'recipe' && content.recipe && (
          <div className="library-card-recipe-meta">
            {content.recipe.prep_time && (
              <span>Prep: {content.recipe.prep_time}</span>
            )}
            {content.recipe.cook_time && (
              <span>Cook: {content.recipe.cook_time}</span>
            )}
            {content.recipe.servings && (
              <span>{content.recipe.servings}</span>
            )}
          </div>
        )}

        {content.tags && content.tags.length > 0 && (
          <div className="library-card-tags">
            {content.tags.slice(0, 5).map((tag, idx) => (
              <span key={idx} className="tag">{tag}</span>
            ))}
            {content.tags.length > 5 && (
              <span className="tag tag-more">+{content.tags.length - 5}</span>
            )}
          </div>
        )}
        {content.source_url && (
          <div className="library-card-source">
            {content.content_type === 'web' ? 'Web article' : 'Video'}
            {content.duration ? ` · ${Math.round(content.duration / 60)} min` : ''}
          </div>
        )}
      </div>
    </div>
  )
}

export default ContentCard
