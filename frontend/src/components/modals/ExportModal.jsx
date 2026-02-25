import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { billingApi } from '../../api/billing'
import { X, FileText, FileJson, FileCode, Download, Loader2, Lock, Crown } from 'lucide-react'
import { Button } from '../ui/button'
import { Badge } from '../ui/badge'
import { trackEvent } from '../../utils/analytics'

const ALL_FORMATS = [
  {
    id: 'txt',
    name: 'Plain Text',
    extension: '.txt',
    description: 'Simple text format',
    icon: FileText,
    iconColor: 'text-zinc-400'
  },
  {
    id: 'md',
    name: 'Markdown',
    extension: '.md',
    description: 'Human-readable format',
    icon: FileText,
    iconColor: 'text-purple-400'
  },
  {
    id: 'json',
    name: 'JSON',
    extension: '.json',
    description: 'Structured data',
    icon: FileJson,
    iconColor: 'text-cyan-400',
    tierRequired: 'pro'
  },
  {
    id: 'pdf',
    name: 'PDF',
    extension: '.pdf',
    description: 'Professional document',
    icon: FileCode,
    iconColor: 'text-red-400',
    tierRequired: 'pro'
  },
  {
    id: 'obsidian',
    name: 'Obsidian',
    extension: '.md',
    description: 'Markdown with YAML frontmatter',
    icon: FileText,
    iconColor: 'text-violet-400',
    tierRequired: 'pro'
  }
]

const CONTENT_TYPE_LABELS = {
  breakdown: 'Content',
  guide: 'Study Guide',
  flashcards: 'Flashcards',
  mindmap: 'Mind Map'
}

function ExportModal({
  isOpen,
  onClose,
  exportFormat,
  setExportFormat,
  includeTranscript,
  setIncludeTranscript,
  isExporting,
  onExport,
  itemCount,
  contentType = 'breakdown'
}) {
  const { token } = useAuth()
  const navigate = useNavigate()
  const [availableFormats, setAvailableFormats] = useState(['txt'])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadFormats = async () => {
      if (!token || !isOpen) return

      try {
        const formats = await billingApi.getExportFormats(token)
        setAvailableFormats(formats)

        // Reset format if current selection isn't available
        if (!formats.includes(exportFormat)) {
          setExportFormat(formats[0] || 'txt')
        }
      } catch (err) {
        console.error('Failed to load export formats:', err)
        setAvailableFormats(['txt'])
      } finally {
        setLoading(false)
      }
    }

    loadFormats()
  }, [token, isOpen])

  if (!isOpen) return null

  const handleFormatSelect = (formatId) => {
    if (availableFormats.includes(formatId)) {
      setExportFormat(formatId)
    }
  }

  const handleUpgrade = () => {
    onClose()
    navigate('/pricing')
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content export-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header" style={{ justifyContent: 'space-between' }}>
          <h2>Export {CONTENT_TYPE_LABELS[contentType] || 'Content'}</h2>
          <button className="modal-close" onClick={onClose}>
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="modal-body">
          <p className="export-desc">
            {contentType !== 'breakdown'
              ? `Export ${CONTENT_TYPE_LABELS[contentType] || contentType} in your preferred format`
              : itemCount === 0
                ? 'Export all items from your library'
                : `Export ${itemCount} selected item(s)`}
          </p>

          <div className="export-formats-list">
            {ALL_FORMATS.map((format) => {
              const isAvailable = availableFormats.includes(format.id)
              const isSelected = exportFormat === format.id
              const Icon = format.icon

              return (
                <div
                  key={format.id}
                  className={`export-format-item ${isSelected ? 'export-format-selected' : ''} ${!isAvailable ? 'export-format-locked' : ''}`}
                  onClick={() => handleFormatSelect(format.id)}
                >
                  <div className="export-format-info">
                    <div className="export-format-name">
                      <Icon className={`w-5 h-5 ${format.iconColor}`} />
                      {format.name}
                      {!isAvailable && format.tierRequired && (
                        <Badge variant="secondary" className="ml-2">
                          <Lock className="w-3 h-3 mr-1" />
                          {format.tierRequired.charAt(0).toUpperCase() + format.tierRequired.slice(1)}
                        </Badge>
                      )}
                    </div>
                    <span className="export-format-desc">{format.description}</span>
                  </div>
                  {isSelected && isAvailable && (
                    <div className="export-format-check">
                      <div className="w-5 h-5 rounded-full bg-purple-500 flex items-center justify-center">
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {availableFormats.length <= 1 && (
            <div className="upgrade-prompt-inline mt-4">
              <div className="upgrade-prompt-inline-icon">
                <Crown className="w-5 h-5 text-purple-500" />
              </div>
              <div className="upgrade-prompt-inline-content">
                <h4 className="font-medium text-sm">Unlock More Export Formats</h4>
                <p className="text-xs text-zinc-500">Upgrade to Pro for Markdown, JSON, and PDF exports</p>
              </div>
              <Button size="sm" onClick={handleUpgrade}>
                Upgrade
              </Button>
            </div>
          )}

          {contentType === 'breakdown' && (
            <div className="export-settings">
              <label className="export-checkbox">
                <input
                  type="checkbox"
                  checked={includeTranscript}
                  onChange={(e) => setIncludeTranscript(e.target.checked)}
                />
                Include full transcripts
              </label>
            </div>
          )}

          <Button
            onClick={() => { trackEvent('export_download', { format: exportFormat, include_transcript: includeTranscript, item_count: itemCount }); onExport() }}
            style={{ width: '100%' }}
            disabled={isExporting || loading}
          >
            {isExporting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="w-4 h-4 mr-2" />
                Download
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}

export default ExportModal
