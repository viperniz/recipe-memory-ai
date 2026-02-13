import React from 'react'
import { useNavigate } from 'react-router-dom'
import { X, FolderPlus, Loader2, AlertTriangle, Crown, Lock } from 'lucide-react'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { useUsageLimits } from '../billing'

function NewCollectionModal({
  isOpen,
  onClose,
  name,
  setName,
  description,
  setDescription,
  onSubmit,
  isSubmitting = false
}) {
  const navigate = useNavigate()
  const { limits, loading, canAddCollection, tier } = useUsageLimits()

  if (!isOpen) return null

  const collectionsUsed = limits?.collections?.used || 0
  const collectionsLimit = limits?.collections?.limit || 3
  const isUnlimited = collectionsLimit === -1

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!canAddCollection) return
    onSubmit()
  }

  const handleUpgrade = () => {
    onClose()
    navigate('/pricing')
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content collection-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>New Collection</h2>
          <button className="modal-close" onClick={onClose}>
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Collection Limit Warning */}
        {!loading && !canAddCollection && (
          <div className="collection-limit-warning">
            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
            <div className="flex-1">
              <strong>Collection Limit Reached</strong>
              <p className="text-xs text-zinc-400 mt-1">
                You've used all {collectionsLimit} collections on the {tier} plan.
              </p>
            </div>
            <Button size="sm" onClick={handleUpgrade}>
              <Crown className="w-3 h-3 mr-1" />
              Upgrade
            </Button>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-group">
              <label>Collection Name *</label>
              <Input
                type="text"
                placeholder="e.g., Python Tutorials"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
                disabled={!canAddCollection}
              />
            </div>
            <div className="form-group">
              <label>Description (optional)</label>
              <Input
                type="text"
                placeholder="What's this collection about?"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={!canAddCollection}
              />
            </div>

            {/* Usage Indicator */}
            {!loading && !isUnlimited && canAddCollection && (
              <p className="text-xs text-zinc-500 mb-3">
                {collectionsUsed} / {collectionsLimit} collections used
              </p>
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={!name.trim() || isSubmitting || !canAddCollection}
            >
              {!canAddCollection ? (
                <>
                  <Lock className="w-4 h-4 mr-2" />
                  Upgrade to Create More
                </>
              ) : isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <FolderPlus className="w-4 h-4 mr-2" />
                  Create Collection
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default NewCollectionModal
