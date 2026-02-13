import React from 'react'
import { X, FolderPlus, FolderOpen } from 'lucide-react'
import { Button } from '../ui/button'

function AddToCollectionModal({
  isOpen,
  onClose,
  collections,
  onSelect,
  onCreateNew
}) {
  if (!isOpen) return null

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content collection-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Add to Collection</h2>
          <button className="modal-close" onClick={onClose}>
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="modal-body">
          {collections.length === 0 ? (
            <div className="empty-state">
              <FolderOpen className="w-12 h-12 mx-auto mb-4 text-zinc-600" />
              <p className="text-zinc-300">No collections yet.</p>
              <Button
                className="mt-4"
                onClick={onCreateNew}
              >
                <FolderPlus className="w-4 h-4 mr-2" />
                Create First Collection
              </Button>
            </div>
          ) : (
            <div className="collection-picker">
              {collections.map(coll => (
                <button
                  key={coll.id}
                  className="collection-picker-item"
                  onClick={() => onSelect(coll.id)}
                >
                  <FolderOpen className="w-6 h-6 text-purple-400" />
                  <div className="collection-picker-info">
                    <div className="collection-picker-name">{coll.name}</div>
                    {coll.description && (
                      <div className="collection-picker-desc">{coll.description}</div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default AddToCollectionModal
