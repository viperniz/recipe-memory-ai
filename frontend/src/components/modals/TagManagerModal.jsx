import React, { useState } from 'react'
import ConfirmModal from './ConfirmModal'
import { X, Plus, Trash2 } from 'lucide-react'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { useAuth } from '../../context/AuthContext'
import { useData } from '../../context/DataContext'
import { tagsApi } from '../../api/tags'
import { toast } from '../../hooks/use-toast'

const PRESET_COLORS = [
  '#3B82F6', '#8B5CF6', '#EC4899', '#EF4444',
  '#F59E0B', '#10B981', '#06B6D4', '#6366F1',
]

function TagManagerModal({ isOpen, onClose }) {
  const { token } = useAuth()
  const { tags, loadTags } = useData()
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState(PRESET_COLORS[0])
  const [editingId, setEditingId] = useState(null)
  const [editName, setEditName] = useState('')
  const [colorPickerId, setColorPickerId] = useState(null)

  if (!isOpen) return null

  const handleCreate = async () => {
    if (!newName.trim()) return
    try {
      await tagsApi.createTag(token, newName.trim(), newColor)
      setNewName('')
      setNewColor(PRESET_COLORS[0])
      loadTags()
    } catch (err) {
      toast({ variant: 'destructive', title: 'Failed to create tag', description: err.response?.data?.detail || err.message })
    }
  }

  const handleRename = async (tagId) => {
    if (!editName.trim()) return
    try {
      await tagsApi.updateTag(token, tagId, editName.trim())
      setEditingId(null)
      loadTags()
    } catch (err) {
      toast({ variant: 'destructive', title: 'Failed to rename tag', description: err.message })
    }
  }

  const handleColorChange = async (tagId, color) => {
    try {
      await tagsApi.updateTag(token, tagId, null, color)
      setColorPickerId(null)
      loadTags()
    } catch {}
  }

  const [confirmState, setConfirmState] = useState({ isOpen: false, tagId: null })

  const handleDelete = (tagId) => {
    setConfirmState({ isOpen: true, tagId })
  }

  const confirmDelete = async () => {
    const tagId = confirmState.tagId
    setConfirmState({ isOpen: false, tagId: null })
    try {
      await tagsApi.deleteTag(token, tagId)
      loadTags()
    } catch (err) {
      toast({ variant: 'destructive', title: 'Failed to delete tag', description: err.message })
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440 }}>
        <div className="modal-header">
          <h2>Manage Tags</h2>
          <button className="modal-close" onClick={onClose}><X className="w-5 h-5" /></button>
        </div>
        <div className="modal-body">
          {/* Create new tag */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <div
              className="tag-color-swatch"
              style={{ width: 36, height: 36, borderRadius: '50%', background: newColor, cursor: 'pointer', flexShrink: 0, border: '2px solid rgba(255,255,255,0.1)' }}
              onClick={() => setColorPickerId(colorPickerId === 'new' ? null : 'new')}
            />
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="New tag name..."
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            />
            <Button onClick={handleCreate} disabled={!newName.trim()}>
              <Plus className="w-4 h-4" />
            </Button>
          </div>
          {colorPickerId === 'new' && (
            <div className="tag-color-palette" style={{ position: 'relative', marginBottom: 12 }}>
              {PRESET_COLORS.map(c => (
                <div
                  key={c}
                  className={`tag-color-option ${newColor === c ? 'selected' : ''}`}
                  style={{ background: c }}
                  onClick={() => { setNewColor(c); setColorPickerId(null) }}
                />
              ))}
            </div>
          )}

          {/* Tag list */}
          <div className="tag-manager-list">
            {tags.map(tag => (
              <div key={tag.id} className="tag-manager-row">
                <div
                  className="tag-color-swatch"
                  style={{ background: tag.color || '#3B82F6' }}
                  onClick={() => setColorPickerId(colorPickerId === tag.id ? null : tag.id)}
                />
                {colorPickerId === tag.id && (
                  <div className="tag-color-palette">
                    {PRESET_COLORS.map(c => (
                      <div
                        key={c}
                        className={`tag-color-option ${(tag.color || '#3B82F6') === c ? 'selected' : ''}`}
                        style={{ background: c }}
                        onClick={() => handleColorChange(tag.id, c)}
                      />
                    ))}
                  </div>
                )}
                {editingId === tag.id ? (
                  <input
                    className="tag-name-input"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleRename(tag.id)
                      if (e.key === 'Escape') setEditingId(null)
                    }}
                    onBlur={() => handleRename(tag.id)}
                    autoFocus
                  />
                ) : (
                  <span
                    style={{ flex: 1, cursor: 'pointer', color: '#e4e4e7', fontSize: 14 }}
                    onClick={() => { setEditingId(tag.id); setEditName(tag.name) }}
                    title="Click to rename"
                  >
                    {tag.name}
                  </span>
                )}
                <span style={{ fontSize: 11, color: '#71717a' }}>
                  {tag.content_count ?? 0}
                </span>
                <button
                  onClick={() => handleDelete(tag.id)}
                  style={{ background: 'none', border: 'none', color: '#71717a', cursor: 'pointer', padding: 4 }}
                  title="Delete tag"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
            {tags.length === 0 && (
              <p style={{ textAlign: 'center', color: '#52525b', fontSize: 13, padding: 16 }}>
                No tags yet. Create one above.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default TagManagerModal
