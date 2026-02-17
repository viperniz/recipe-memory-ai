import React, { useState } from 'react'
import { X, Share2, Loader2, Check } from 'lucide-react'
import { Button } from '../ui/button'
import { useData } from '../../context/DataContext'

function ShareContentModal({ isOpen, onClose, teams, onShare, isSharing }) {
  const { libraryContents } = useData()
  const [selectedContent, setSelectedContent] = useState(null)
  const [selectedTeam, setSelectedTeam] = useState(teams?.[0]?.id || null)

  if (!isOpen) return null

  const handleShare = () => {
    if (selectedContent && selectedTeam) {
      onShare(selectedTeam, selectedContent)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: 520 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Share Content to Team</h2>
          <button className="modal-close" onClick={onClose}>
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="modal-body">
          {teams.length > 1 && (
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', color: '#a1a1aa', fontSize: 13, marginBottom: 6 }}>
                Select team
              </label>
              <select
                className="invite-role-select"
                style={{ width: '100%' }}
                value={selectedTeam || ''}
                onChange={(e) => setSelectedTeam(e.target.value)}
              >
                {teams.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
          )}

          <label style={{ display: 'block', color: '#a1a1aa', fontSize: 13, marginBottom: 6 }}>
            Select content to share
          </label>
          <div className="share-content-list">
            {libraryContents.map(item => (
              <div
                key={item.id}
                className={`share-content-item ${selectedContent === item.id ? 'selected' : ''}`}
                onClick={() => setSelectedContent(item.id)}
              >
                {selectedContent === item.id && <Check className="w-4 h-4" style={{ color: '#8b5cf6', flexShrink: 0 }} />}
                <div style={{ minWidth: 0 }}>
                  <div style={{ color: '#e4e4e7', fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.title || 'Untitled'}
                  </div>
                  <div style={{ color: '#71717a', fontSize: 11 }}>
                    {item.content_type || 'video'}
                  </div>
                </div>
              </div>
            ))}
            {libraryContents.length === 0 && (
              <p style={{ color: '#71717a', fontSize: 13, textAlign: 'center', padding: 24 }}>
                No content in your library to share.
              </p>
            )}
          </div>

          <div style={{ marginTop: 16 }}>
            <Button
              onClick={handleShare}
              disabled={isSharing || !selectedContent || !selectedTeam}
              className="w-full"
            >
              {isSharing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Sharing...
                </>
              ) : (
                <>
                  <Share2 className="w-4 h-4 mr-2" />
                  Share to Team
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ShareContentModal
