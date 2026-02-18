import React, { useState, useEffect, useRef, useCallback } from 'react'
import { X, Download, ChefHat, GraduationCap, Video, Users, BookOpen, Loader2, Copy, Check, Globe, MessageSquare, Layers, Network, CheckCircle, RotateCcw, Eye, Lock, Camera, Grid3X3, Search, StickyNote, Bookmark as BookmarkIcon } from 'lucide-react'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import RecipeCard from './RecipeCard'
import LearnCard from './LearnCard'
import CreatorCard from './CreatorCard'
import MeetingCard from './MeetingCard'
import DeepDiveCard from './DeepDiveCard'
import TimestampLink from './TimestampLink'
import VideoChatPanel from './VideoChatPanel'
import FlashcardPanel from './FlashcardPanel'
import MindMapPanel from './MindMapPanel'
import axios from 'axios'
import { toast } from '../../hooks/use-toast'
import { ToastAction } from '../ui/toast'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { billingApi } from '../../api/billing'
import { buildYouTubeTimestampUrl, formatTimestamp } from '../../lib/utils'
import { useData } from '../../context/DataContext'
import { tagsApi } from '../../api/tags'

const API_BASE = import.meta.env.VITE_API_URL || '/api'

const MODE_ICONS = {
  recipe: ChefHat,
  learn: GraduationCap,
  creator: Video,
  meeting: Users,
  deepdive: Search,
  web: Globe
}

/**
 * Inline Notes panel: free-form notes with auto-save + bookmark pills
 */
function NotesPanel({ contentId }) {
  const { token } = useAuth()
  const [notes, setNotes] = useState([])
  const [noteText, setNoteText] = useState('')
  const [bookmarks, setBookmarks] = useState([])
  const [saveStatus, setSaveStatus] = useState('') // '', 'saving', 'saved'
  const [isLoading, setIsLoading] = useState(true)
  const debounceRef = useRef(null)

  // Load notes & bookmarks
  useEffect(() => {
    if (!contentId || !token) return
    setIsLoading(true)
    Promise.all([
      axios.get(`${API_BASE}/notes?content_id=${contentId}`, { headers: { Authorization: `Bearer ${token}` } }),
      axios.get(`${API_BASE}/bookmarks?content_id=${contentId}`, { headers: { Authorization: `Bearer ${token}` } }),
    ]).then(([notesRes, bookmarksRes]) => {
      const loaded = notesRes.data.notes || []
      setNotes(loaded)
      // Combine all note texts for a single textarea
      setNoteText(loaded.map(n => n.note_text).join('\n\n'))
      setBookmarks(bookmarksRes.data.bookmarks || [])
    }).catch(() => {}).finally(() => setIsLoading(false))
  }, [contentId, token])

  // Auto-save with debounce
  const saveNotes = useCallback(async (text) => {
    setSaveStatus('saving')
    try {
      // Delete existing notes for this content then create new one
      for (const n of notes) {
        await axios.delete(`${API_BASE}/notes/${n.id}`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => {})
      }
      if (text.trim()) {
        const res = await axios.post(`${API_BASE}/notes`, {
          content_id: contentId,
          note_text: text.trim()
        }, { headers: { Authorization: `Bearer ${token}` } })
        setNotes([res.data])
      } else {
        setNotes([])
      }
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus(''), 2000)
    } catch {
      setSaveStatus('')
    }
  }, [contentId, token, notes])

  const handleChange = (e) => {
    const text = e.target.value
    setNoteText(text)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => saveNotes(text), 1000)
  }

  const handleDeleteBookmark = async (id) => {
    try {
      await axios.delete(`${API_BASE}/bookmarks/${id}`, { headers: { Authorization: `Bearer ${token}` } })
      setBookmarks(prev => prev.filter(b => b.id !== id))
    } catch {}
  }

  if (isLoading) return <div className="loading-state" style={{ padding: '2rem' }}>Loading notes...</div>

  return (
    <div className="notes-panel">
      <textarea
        className="notes-textarea"
        value={noteText}
        onChange={handleChange}
        placeholder="Add your notes here... Auto-saves as you type."
      />
      <div className="notes-meta-row">
        <span>{noteText.length} characters</span>
        {saveStatus && (
          <span className={`notes-save-indicator ${saveStatus}`}>
            {saveStatus === 'saving' ? (
              <><Loader2 className="w-3 h-3 animate-spin" /> Saving...</>
            ) : (
              <><Check className="w-3 h-3" /> Saved</>
            )}
          </span>
        )}
      </div>
      {bookmarks.length > 0 && (
        <>
          <h4 style={{ fontSize: 13, color: '#a1a1aa', marginTop: 16, marginBottom: 8 }}>Bookmarks</h4>
          <div className="bookmark-pills">
            {bookmarks.map(b => {
              const mins = Math.floor((b.timestamp_seconds || 0) / 60)
              const secs = Math.floor((b.timestamp_seconds || 0) % 60)
              return (
                <span key={b.id} className="bookmark-pill">
                  <BookmarkIcon className="w-3 h-3" />
                  {mins}:{secs.toString().padStart(2, '0')}
                  {b.label && ` — ${b.label}`}
                  <button className="bookmark-remove" onClick={() => handleDeleteBookmark(b.id)}>
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

function ContentDetailModal({ content, isLoading, onClose, onExport }) {
  const [isGeneratingGuide, setIsGeneratingGuide] = useState(false)
  const [generatedGuide, setGeneratedGuide] = useState(null)
  const [activeTab, setActiveTab] = useState('content') // content, guide, chat, flashcards, mindmap
  const [copiedStep, setCopiedStep] = useState(null)
  const [isDownloadingGuide, setIsDownloadingGuide] = useState(false)
  const [timelineView, setTimelineView] = useState('timeline') // 'timeline' | 'visual-grid' | 'transcript'
  const [isGeneratingThumbnails, setIsGeneratingThumbnails] = useState(false)
  const [subscription, setSubscription] = useState(null)
  const [contentTags, setContentTags] = useState([])
  const [showTagDropdown, setShowTagDropdown] = useState(false)
  const navigate = useNavigate()
  const { token } = useAuth()
  const { tags: allTags, loadTags } = useData()

  // Load content tags
  useEffect(() => {
    if (!content?.id || !token) return
    tagsApi.getContentTags(token, content.id)
      .then(res => setContentTags(res.tags || []))
      .catch(() => {})
  }, [content?.id, token])

  const handleAddTag = async (tagId) => {
    try {
      await tagsApi.addTagsToContent(token, content.id, [tagId])
      const res = await tagsApi.getContentTags(token, content.id)
      setContentTags(res.tags || [])
      loadTags()
      setShowTagDropdown(false)
    } catch {}
  }

  const handleRemoveTag = async (tagId) => {
    try {
      await tagsApi.removeTagFromContent(token, content.id, tagId)
      setContentTags(prev => prev.filter(t => t.id !== tagId))
      loadTags()
    } catch {}
  }

  // Fetch subscription for feature access checks
  useEffect(() => {
    if (!token) return
    billingApi.getSubscription(token)
      .then(sub => setSubscription(sub))
      .catch(() => {})
  }, [token])

  // Load stored guide on mount
  useEffect(() => {
    if (!content?.id) return
    const loadStoredGuide = async () => {
      try {
        const token = localStorage.getItem('token')
        const response = await axios.get(
          `${API_BASE}/content/${content.id}/generated/guide`,
          { headers: { Authorization: `Bearer ${token}` } }
        )
        if (response.data.data) {
          setGeneratedGuide(response.data.data)
        }
      } catch (err) {
        // Silently ignore
      }
    }
    loadStoredGuide()
  }, [content?.id])

  if (!content) return null

  const mode = content.mode || 'general'
  const ModeIcon = MODE_ICONS[mode] || null

  const handlePrint = () => {
    window.print()
  }

  // Check if content has frame descriptions but no thumbnails
  const hasThumbnails = content.metadata?.thumbnails?.length > 0 ||
    content.timeline?.some(e => e.type === 'vision' && e.thumbnail)
  const canGenerateThumbnails = !hasThumbnails &&
    (content.frame_descriptions?.length > 0 || content.timeline?.some(e => e.type === 'vision'))

  const handleGenerateThumbnails = async () => {
    setIsGeneratingThumbnails(true)
    try {
      const token = localStorage.getItem('token')
      const response = await axios.post(
        `${API_BASE}/content/${content.id}/generate-thumbnails`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      )
      toast({
        variant: 'success',
        title: 'Thumbnails generated',
        description: `Generated ${response.data.thumbnails?.length || 0} thumbnails`
      })
      // Reload page to show thumbnails
      window.location.reload()
    } catch (err) {
      console.error('Failed to generate thumbnails:', err)
      toast({
        variant: 'destructive',
        title: 'Failed to generate thumbnails',
        description: err.response?.data?.detail || 'Unknown error'
      })
    } finally {
      setIsGeneratingThumbnails(false)
    }
  }

  const handleGenerateGuide = async (regenerate = false) => {
    setIsGeneratingGuide(true)
    try {
      const token = localStorage.getItem('token')
      const response = await axios.post(
        `${API_BASE}/content/${content.id}/generate-guide`,
        { format: 'json', regenerate },
        { headers: { Authorization: `Bearer ${token}` } }
      )

      if (response.data.success) {
        setGeneratedGuide(response.data.guide)
        setActiveTab('guide')
        toast({
          variant: 'success',
          title: regenerate ? 'Guide regenerated' : 'Guide generated',
          description: 'Step-by-step guide is ready'
        })
      }
    } catch (err) {
      console.error('Failed to generate guide:', err)
      const errorDetail = err.response?.data?.detail
      if (err.response?.status === 403 && typeof errorDetail === 'object') {
        if (errorDetail.error === 'insufficient_credits') {
          toast({
            variant: 'destructive',
            title: 'Usage Limit Reached',
            description: `Not enough usage allowance remaining.`,
            action: (
              <ToastAction altText="Upgrade" onClick={() => navigate('/pricing')}>
                Upgrade
              </ToastAction>
            ),
            duration: 8000
          })
        } else {
          toast({
            variant: 'destructive',
            title: 'Access Denied',
            description: errorDetail.message || 'Upgrade your plan.',
            action: (
              <ToastAction altText="Upgrade" onClick={() => navigate('/pricing')}>
                Upgrade
              </ToastAction>
            ),
            duration: 8000
          })
        }
      } else {
        toast({
          variant: 'destructive',
          title: 'Failed to generate guide',
          description: typeof errorDetail === 'string' ? errorDetail : err.message
        })
      }
    } finally {
      setIsGeneratingGuide(false)
    }
  }

  const handleDownloadGuide = async () => {
    setIsDownloadingGuide(true)
    try {
      const token = localStorage.getItem('token')
      const response = await axios.post(
        `${API_BASE}/content/${content.id}/generate-guide`,
        { format: 'markdown' },
        {
          headers: { Authorization: `Bearer ${token}` },
          responseType: 'blob'
        }
      )

      const url = window.URL.createObjectURL(response.data)
      const a = document.createElement('a')
      a.href = url
      a.download = `guide-${content.id}.md`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      toast({
        variant: 'success',
        title: 'Guide downloaded',
        description: 'Markdown file saved'
      })
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Download failed',
        description: err.message
      })
    } finally {
      setIsDownloadingGuide(false)
    }
  }

  // Handle export based on active tab
  const handleExport = () => {
    if (activeTab === 'guide' && generatedGuide) {
      // Export guide as markdown (Pro only)
      handleDownloadGuide()
    } else {
      // Regular content export
      onExport()
    }
  }

  const copyToClipboard = (text, stepId) => {
    navigator.clipboard.writeText(text)
    setCopiedStep(stepId)
    setTimeout(() => setCopiedStep(null), 2000)
  }

  // Determine which card to render
  const renderModeContent = () => {
    switch (mode) {
      case 'recipe':
        if (content.recipe) {
          return <RecipeCard recipe={content.recipe} onPrint={handlePrint} sourceUrl={content.source_url} />
        }
        break
      case 'learn':
        if (content.learn) {
          return <LearnCard learn={content.learn} sourceUrl={content.source_url} />
        }
        break
      case 'creator':
        if (content.creator) {
          return <CreatorCard creator={content.creator} sourceUrl={content.source_url} />
        }
        break
      case 'meeting':
        if (content.meeting) {
          return <MeetingCard meeting={content.meeting} sourceUrl={content.source_url} />
        }
        break
      case 'deepdive':
        if (content.deepdive) {
          return <DeepDiveCard deepdive={content.deepdive} sourceUrl={content.source_url} />
        }
        break
    }
    // Fall back to general view
    return null
  }

  const modeContent = renderModeContent()

  // Render the generated guide
  const renderGuide = () => {
    if (!generatedGuide) return null

    return (
      <div className="generated-guide">
        <div className="guide-header">
          <h3>{generatedGuide.title}</h3>
          <div className="guide-meta">
            <Badge variant="outline">{generatedGuide.difficulty}</Badge>
            <span className="guide-time">{generatedGuide.estimated_time}</span>
          </div>
          <p className="guide-description">{generatedGuide.description}</p>
        </div>

        {/* Prerequisites */}
        {generatedGuide.prerequisites?.length > 0 && (
          <div className="guide-section">
            <h4>Prerequisites</h4>
            {generatedGuide.prerequisites.map((prereq, idx) => (
              <div key={idx} className="prereq-item">
                <strong>{prereq.item}</strong>
                <p>{prereq.description}</p>
                {prereq.install_command && (
                  <div className="code-block">
                    <code>{prereq.install_command}</code>
                    <button
                      className="copy-btn"
                      onClick={() => copyToClipboard(prereq.install_command, `prereq-${idx}`)}
                    >
                      {copiedStep === `prereq-${idx}` ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                )}
                {prereq.check_command && (
                  <div className="code-block verify">
                    <span className="verify-label">Verify:</span>
                    <code>{prereq.check_command}</code>
                    <button
                      className="copy-btn"
                      onClick={() => copyToClipboard(prereq.check_command, `prereq-check-${idx}`)}
                    >
                      {copiedStep === `prereq-check-${idx}` ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Environment Setup */}
        {generatedGuide.environment_setup?.length > 0 && (
          <div className="guide-section">
            <h4>Environment Setup</h4>
            {generatedGuide.environment_setup.map((setup, idx) => (
              <div key={idx} className="setup-item">
                <strong>{setup.step}</strong>
                {setup.commands?.map((cmd, cmdIdx) => (
                  <div key={cmdIdx} className="code-block">
                    <code>{cmd}</code>
                    <button
                      className="copy-btn"
                      onClick={() => copyToClipboard(cmd, `setup-${idx}-${cmdIdx}`)}
                    >
                      {copiedStep === `setup-${idx}-${cmdIdx}` ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                ))}
                {setup.notes && <p className="setup-notes">{setup.notes}</p>}
              </div>
            ))}
          </div>
        )}

        {/* Steps */}
        <div className="guide-section">
          <h4>Steps</h4>
          {generatedGuide.steps?.map((step, idx) => (
            <div key={idx} className="guide-step">
              <div className="step-header">
                <span className="step-number">{step.step_number}</span>
                <span className="step-title">{step.title}</span>
              </div>
              <p className="step-description">{step.description}</p>

              {step.commands?.length > 0 && (
                <div className="step-commands">
                  {step.commands.map((cmd, cmdIdx) => (
                    <div key={cmdIdx} className="code-block">
                      <code>{cmd}</code>
                      <button
                        className="copy-btn"
                        onClick={() => copyToClipboard(cmd, `step-${idx}-cmd-${cmdIdx}`)}
                      >
                        {copiedStep === `step-${idx}-cmd-${cmdIdx}` ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {step.code && (
                <div className="step-code">
                  <div className="code-block-large">
                    <div className="code-header">
                      <span>{step.code_language || 'code'}</span>
                      <button
                        className="copy-btn"
                        onClick={() => copyToClipboard(step.code, `step-${idx}-code`)}
                      >
                        {copiedStep === `step-${idx}-code` ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                    <pre><code>{step.code}</code></pre>
                  </div>
                </div>
              )}

              {step.expected_output && (
                <div className="expected-output">
                  <strong>Expected Output:</strong> {step.expected_output}
                </div>
              )}

              {step.troubleshooting?.length > 0 && (
                <div className="troubleshooting">
                  <strong>Troubleshooting:</strong>
                  {step.troubleshooting.map((issue, issueIdx) => (
                    <div key={issueIdx} className="troubleshoot-item">
                      <span className="issue">{issue.issue}</span>
                      <span className="solution">{issue.solution}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Verification */}
        {generatedGuide.verification && (
          <div className="guide-section">
            <h4>Verification</h4>
            <p>{generatedGuide.verification.description}</p>
            {generatedGuide.verification.commands?.map((cmd, idx) => (
              <div key={idx} className="code-block">
                <code>{cmd}</code>
                <button
                  className="copy-btn"
                  onClick={() => copyToClipboard(cmd, `verify-${idx}`)}
                >
                  {copiedStep === `verify-${idx}` ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            ))}
            {generatedGuide.verification.expected_result && (
              <div className="expected-output">
                <strong>Expected Result:</strong> {generatedGuide.verification.expected_result}
              </div>
            )}
          </div>
        )}

        {/* Next Steps */}
        {generatedGuide.next_steps?.length > 0 && (
          <div className="guide-section">
            <h4>Next Steps</h4>
            <ul>
              {generatedGuide.next_steps.map((step, idx) => (
                <li key={idx}>{step}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Resources */}
        {generatedGuide.resources?.length > 0 && (
          <div className="guide-section">
            <h4>Resources</h4>
            <ul className="resources-list">
              {generatedGuide.resources.map((res, idx) => (
                <li key={idx}>
                  {res.url ? (
                    <a href={res.url} target="_blank" rel="noopener noreferrer">{res.name}</a>
                  ) : (
                    <strong>{res.name}</strong>
                  )}
                  {res.description && <span> - {res.description}</span>}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="guide-actions">
          <Button
            variant="outline"
            onClick={() => handleGenerateGuide(true)}
            disabled={isGeneratingGuide}
          >
            {isGeneratingGuide ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <RotateCcw className="w-4 h-4 mr-2" />
            )}
            Regenerate
          </Button>
          <Button
            onClick={handleDownloadGuide}
            variant="outline"
            disabled={isDownloadingGuide}
          >
            {isDownloadingGuide ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Download className="w-4 h-4 mr-2" />
            )}
            Download as Markdown
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content modal-content-large" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-header-title">
            {ModeIcon && <ModeIcon className="w-5 h-5 mr-2 text-purple-400" />}
            <h2>{content.title || 'Untitled'}</h2>
            {/* Tag pills */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 8, flexWrap: 'wrap' }}>
              {contentTags.map(tag => (
                <span key={tag.id} className="tag-pill" style={{ background: `${tag.color || '#3B82F6'}20` }}>
                  <span className="tag-pill-dot" style={{ background: tag.color || '#3B82F6' }} />
                  {tag.name}
                  <button className="tag-pill-remove" onClick={(e) => { e.stopPropagation(); handleRemoveTag(tag.id) }}>
                    <X className="w-2.5 h-2.5" />
                  </button>
                </span>
              ))}
              <div className="tag-assign-dropdown">
                <button
                  style={{ background: 'none', border: '1px dashed rgba(255,255,255,0.15)', borderRadius: 10, padding: '2px 8px', color: '#71717a', fontSize: 11, cursor: 'pointer' }}
                  onClick={() => setShowTagDropdown(!showTagDropdown)}
                >
                  + Tag
                </button>
                {showTagDropdown && (
                  <div className="tag-assign-menu">
                    {allTags.filter(t => !contentTags.some(ct => ct.id === t.id)).map(tag => (
                      <button key={tag.id} className="tag-assign-option" onClick={() => handleAddTag(tag.id)}>
                        <span className="tag-pill-dot" style={{ background: tag.color || '#3B82F6' }} />
                        {tag.name}
                      </button>
                    ))}
                    {allTags.filter(t => !contentTags.some(ct => ct.id === t.id)).length === 0 && (
                      <span style={{ padding: '8px 10px', fontSize: 12, color: '#52525b' }}>No more tags</span>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="modal-header-actions">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleGenerateGuide()}
              disabled={isGeneratingGuide}
            >
              {isGeneratingGuide ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <BookOpen className="w-4 h-4 mr-2" />
                  Generate Study Guide
                </>
              )}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              disabled={isDownloadingGuide}
            >
              {isDownloadingGuide ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Download className="w-4 h-4 mr-2" />
              )}
              {activeTab === 'guide' && generatedGuide ? (
                'Export Guide'
              ) : (
                'Export'
              )}
            </Button>
            <button className="modal-close" onClick={onClose}>
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab switcher — always visible, with tier gate badges */}
        <div className="content-tabs">
          <button
            className={`content-tab ${activeTab === 'content' ? 'active' : ''}`}
            onClick={() => setActiveTab('content')}
          >
            Breakdown
          </button>
          <button
            className={`content-tab ${activeTab === 'guide' ? 'active' : ''}`}
            onClick={() => {
              if (generatedGuide) {
                setActiveTab('guide')
              } else {
                handleGenerateGuide()
              }
            }}
          >
            <BookOpen className="w-3.5 h-3.5" />
            Study Guide
            {generatedGuide && <CheckCircle className="w-3 h-3" style={{ color: '#22c55e' }} />}
            {!subscription?.guide_generation && <Lock className="w-3 h-3 text-zinc-500" />}
          </button>
          <button
            className={`content-tab ${activeTab === 'chat' ? 'active' : ''}`}
            onClick={() => setActiveTab('chat')}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            Ask
          </button>
          <button
            className={`content-tab ${activeTab === 'flashcards' ? 'active' : ''}`}
            onClick={() => setActiveTab('flashcards')}
          >
            <Layers className="w-3.5 h-3.5" />
            Flashcards
            {!subscription?.flashcard_generation && <Lock className="w-3 h-3 text-zinc-500" />}
          </button>
          <button
            className={`content-tab ${activeTab === 'mindmap' ? 'active' : ''}`}
            onClick={() => setActiveTab('mindmap')}
          >
            <Network className="w-3.5 h-3.5" />
            Mind Map
            {!subscription?.mindmap_generation && <Lock className="w-3 h-3 text-zinc-500" />}
          </button>
          <button
            className={`content-tab ${activeTab === 'notes' ? 'active' : ''}`}
            onClick={() => setActiveTab('notes')}
          >
            <StickyNote className="w-3.5 h-3.5" />
            Notes
          </button>
        </div>

        <div className="modal-body">
          {isLoading ? (
            <div className="loading-state">Loading...</div>
          ) : activeTab === 'guide' && generatedGuide ? (
            renderGuide()
          ) : activeTab === 'guide' && !generatedGuide ? (
            <div className="flashcard-generate" style={{ padding: '3rem 2rem', textAlign: 'center' }}>
              <BookOpen className="w-10 h-10 text-purple-500 mx-auto mb-3" />
              <p>Generate a comprehensive step-by-step guide from this content</p>
              <Button onClick={() => handleGenerateGuide()} disabled={isGeneratingGuide}>
                {isGeneratingGuide ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  'Generate Guide'
                )}
              </Button>
            </div>
          ) : activeTab === 'notes' ? (
            <NotesPanel contentId={content.id} />
          ) : activeTab === 'chat' ? (
            <VideoChatPanel contentId={content.id} sourceUrl={content.source_url} />
          ) : activeTab === 'flashcards' ? (
            <FlashcardPanel contentId={content.id} />
          ) : activeTab === 'mindmap' ? (
            <MindMapPanel contentId={content.id} sourceUrl={content.source_url} />
          ) : (
            <>
              <div className="ai-disclaimer" onClick={() => setActiveTab('chat')}>
                <MessageSquare className="w-3.5 h-3.5" />
                <span>AI-generated analysis — may contain errors. <strong>Chat with the transcript</strong> for precise answers.</span>
              </div>
              {modeContent ? (
                // Mode-specific display (creator, recipe, learn, meeting)
                modeContent
              ) : (
                // General Mode Display (fallback)
                <>
                  <div className="content-detail-section">
                    <Badge variant="default" className="mb-4">
                      {content.content_type || 'video'}
                    </Badge>
                    {content.mode && content.mode !== 'general' && (
                      <Badge variant="outline" className="ml-2 mb-4">
                        {content.mode} mode
                      </Badge>
                    )}
                    {content.metadata?.detected_language_name && (
                      <Badge variant="outline" className="ml-2 mb-4">
                        {content.metadata.translated_to_name
                          ? `${content.metadata.detected_language_name} → ${content.metadata.translated_to_name}`
                          : content.metadata.detected_language_name}
                      </Badge>
                    )}
                  </div>

                  {content.summary && (
                    <div className="content-detail-section">
                      <h3>Summary</h3>
                      <p>{content.summary}</p>
                    </div>
                  )}

                  {content.key_points && content.key_points.length > 0 && (
                    <div className="content-detail-section">
                      <h3>Key Points</h3>
                      <ul className="key-points-list">
                        {content.key_points.map((kp, idx) => (
                          <li key={idx}>
                            {typeof kp === 'object' ? (
                              <>
                                <strong>{kp.point || kp.text || 'Point'}</strong>
                                {kp.timestamp && (
                                  <>
                                    {' '}
                                    <TimestampLink timestamp={kp.timestamp} sourceUrl={content.source_url} />
                                  </>
                                )}
                                {kp.description && <p>{kp.description}</p>}
                              </>
                            ) : (
                              <span>{kp}</span>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Web content specific sections */}
                  {content.tools_mentioned?.length > 0 && (
                    <div className="content-detail-section">
                      <h3>Tools Mentioned</h3>
                      <div className="tools-list">
                        {content.tools_mentioned.map((tool, idx) => (
                          <div key={idx} className="tool-item">
                            <strong>{tool.name}</strong>
                            {tool.pricing && <Badge variant="outline" className="ml-2">{tool.pricing}</Badge>}
                            {tool.description && <p>{tool.description}</p>}
                            {tool.url && (
                              <a href={tool.url} target="_blank" rel="noopener noreferrer" className="tool-link">
                                Visit {tool.name}
                              </a>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {content.methods?.length > 0 && (
                    <div className="content-detail-section">
                      <h3>Methods</h3>
                      {content.methods.map((method, idx) => (
                        <div key={idx} className="method-item">
                          <strong>{method.method}</strong>
                          {method.difficulty && <Badge variant="outline" className="ml-2">{method.difficulty}</Badge>}
                          {method.steps?.length > 0 && (
                            <ol className="method-steps">
                              {method.steps.map((step, stepIdx) => (
                                <li key={stepIdx}>{step}</li>
                              ))}
                            </ol>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {content.entities && content.entities.length > 0 && (
                    <div className="content-detail-section">
                      <h3>Entities</h3>
                      <div className="entities-list">
                        {content.entities.map((entity, idx) => (
                          <span key={idx} className="entity-tag">
                            {typeof entity === 'object' ? entity.name || entity.entity : entity}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {content.tags && content.tags.length > 0 && (
                    <div className="content-detail-section">
                      <h3>Tags</h3>
                      <div className="tags-list">
                        {content.tags.map((tag, idx) => (
                          <span key={idx} className="tag">{tag}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {content.topics && content.topics.length > 0 && (
                    <div className="content-detail-section">
                      <h3>Topics</h3>
                      <p>{content.topics.join(', ')}</p>
                    </div>
                  )}

                  {content.action_items && content.action_items.length > 0 && (
                    <div className="content-detail-section">
                      <h3>Action Items</h3>
                      <ul className="action-items-list">
                        {content.action_items.map((item, idx) => (
                          <li key={idx}>{typeof item === 'object' ? item.item || item.text : item}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {content.quotes && content.quotes.length > 0 && (
                    <div className="content-detail-section">
                      <h3>Notable Quotes</h3>
                      <div className="quotes-list">
                        {content.quotes.map((quote, idx) => (
                          <blockquote key={idx} className="quote">
                            {typeof quote === 'object' ? quote.text || quote.quote : quote}
                            {typeof quote === 'object' && quote.speaker && (
                              <cite>- {quote.speaker}</cite>
                            )}
                            {typeof quote === 'object' && quote.timestamp && (
                              <>
                                {' '}
                                <TimestampLink timestamp={quote.timestamp} sourceUrl={content.source_url} />
                              </>
                            )}
                          </blockquote>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Unified Timeline / Visual Grid / Transcript Views — always shown */}
              {content.timeline && content.timeline.length > 0 ? (
                <>
                  {/* View toggle + Generate Thumbnails button */}
                  <div className="content-detail-section">
                    <div className="timeline-view-toggle">
                      <button
                        className={`timeline-toggle-btn ${timelineView === 'timeline' ? 'active' : ''}`}
                        onClick={() => setTimelineView('timeline')}
                      >
                        Timeline
                      </button>
                      <button
                        className={`timeline-toggle-btn ${timelineView === 'visual-grid' ? 'active' : ''}`}
                        onClick={() => setTimelineView('visual-grid')}
                      >
                        <Grid3X3 className="w-3 h-3" style={{ display: 'inline', verticalAlign: 'middle', marginRight: 3 }} />
                        Visual Grid
                      </button>
                      <button
                        className={`timeline-toggle-btn ${timelineView === 'transcript' ? 'active' : ''}`}
                        onClick={() => setTimelineView('transcript')}
                      >
                        Transcript
                      </button>
                      {canGenerateThumbnails && (
                        <button
                          className="timeline-toggle-btn generate-thumbs-btn"
                          onClick={handleGenerateThumbnails}
                          disabled={isGeneratingThumbnails}
                          title="Generate frame thumbnails from video"
                        >
                          {isGeneratingThumbnails
                            ? <Loader2 className="w-3 h-3 animate-spin" style={{ display: 'inline', verticalAlign: 'middle', marginRight: 3 }} />
                            : <Camera className="w-3 h-3" style={{ display: 'inline', verticalAlign: 'middle', marginRight: 3 }} />
                          }
                          {isGeneratingThumbnails ? 'Generating...' : 'Generate Thumbnails'}
                        </button>
                      )}
                    </div>
                  </div>

                  {timelineView === 'timeline' && (
                    <div className="content-detail-section">
                      <h3>Transcript & Visual Timeline</h3>
                      <div className="timeline-container">
                        {content.timeline.map((entry, idx) => {
                          const mins = Math.floor(entry.timestamp / 60)
                          const secs = Math.floor(entry.timestamp % 60)
                          const tsStr = `${mins}:${secs.toString().padStart(2, '0')}`

                          if (entry.type === 'vision') {
                            const ytUrl = buildYouTubeTimestampUrl(content.source_url, entry.timestamp)
                            return (
                              <div key={idx} className="timeline-entry vision">
                                <div className="timeline-header">
                                  <TimestampLink timestamp={tsStr} sourceUrl={content.source_url} />
                                  <span className="timeline-vision-badge">
                                    <Eye className="w-3 h-3" style={{ display: 'inline', verticalAlign: 'middle', marginRight: 3 }} />
                                    Visual
                                  </span>
                                </div>
                                {entry.thumbnail && (
                                  <a href={ytUrl || '#'} target="_blank" rel="noopener noreferrer" className="timeline-thumbnail-link">
                                    <img src={entry.thumbnail} alt={entry.caption || ''} className="timeline-thumbnail" loading="lazy" />
                                  </a>
                                )}
                                <div className="timeline-caption">{entry.caption || entry.text}</div>
                                {entry.text && entry.caption && (
                                  <details className="timeline-full-desc">
                                    <summary>Full description</summary>
                                    <div className="timeline-text">{entry.text}</div>
                                  </details>
                                )}
                                {!entry.caption && (
                                  <div className="timeline-text">{entry.text}</div>
                                )}
                              </div>
                            )
                          }

                          return (
                            <div key={idx} className="timeline-entry transcript">
                              <div className="timeline-header">
                                <TimestampLink timestamp={tsStr} sourceUrl={content.source_url} />
                                {entry.speaker && entry.speaker !== 'Unknown' && (
                                  <span className="transcript-speaker">{entry.speaker}</span>
                                )}
                              </div>
                              <div className="timeline-text">{entry.text}</div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {timelineView === 'visual-grid' && (
                    <div className="content-detail-section">
                      <h3>Visual Grid</h3>
                      <div className="visual-grid">
                        {content.timeline.filter(e => e.type === 'vision').map((entry, idx) => {
                          const ytUrl = buildYouTubeTimestampUrl(content.source_url, entry.timestamp)
                          return (
                            <a key={idx} href={ytUrl || '#'} target="_blank" rel="noopener noreferrer" className="visual-grid-item">
                              {entry.thumbnail ? (
                                <img src={entry.thumbnail} alt="" className="visual-grid-thumb" loading="lazy" />
                              ) : (
                                <div className="visual-grid-thumb-placeholder">
                                  <Eye className="w-6 h-6" />
                                </div>
                              )}
                              <div className="visual-grid-overlay">
                                <span className="visual-grid-time">{formatTimestamp(entry.timestamp)}</span>
                              </div>
                              <p className="visual-grid-caption">{entry.caption || entry.text}</p>
                            </a>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {timelineView === 'transcript' && (
                    <div className="content-detail-section">
                      <h3>Transcript</h3>
                      <div className="transcript-view">
                        {content.timeline.filter(e => e.type === 'transcript').map((entry, idx) => {
                          const tsStr = formatTimestamp(entry.timestamp)
                          return (
                            <div key={idx} className="transcript-entry">
                              <div className="transcript-header">
                                <TimestampLink timestamp={tsStr} sourceUrl={content.source_url} />
                                {entry.speaker && entry.speaker !== 'Unknown' && (
                                  <span className="transcript-speaker">{entry.speaker}</span>
                                )}
                              </div>
                              <div className="transcript-text">{entry.text}</div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <>
                  {/* Fallback: separate sections for old content without timeline */}
                  {content.frame_descriptions && content.frame_descriptions.length > 0 && (
                    <div className="content-detail-section">
                      <h3>Visual Analysis</h3>
                      <div className="frame-descriptions-container">
                        {content.frame_descriptions.map((desc, idx) => {
                          const match = desc.match(/^\[(\d+(?:\.\d+)?)s\]\s*(.*)$/)
                          if (match) {
                            const [, secondsStr, description] = match
                            const seconds = parseFloat(secondsStr)
                            return (
                              <div key={idx} className="frame-description-entry">
                                <div className="frame-description-header">
                                  <TimestampLink timestamp={String(Math.floor(seconds))} sourceUrl={content.source_url} />
                                </div>
                                <div className="frame-description-text">{description.trim()}</div>
                              </div>
                            )
                          }
                          return (
                            <div key={idx} className="frame-description-entry">
                              <div className="frame-description-text">{desc}</div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {content.transcript && (
                    <div className="content-detail-section">
                      <h3>Full Transcript</h3>
                      <div className="transcript-container">
                        {content.transcript.split('\n\n').map((paragraph, idx) => {
                          if (!paragraph.trim()) return null
                          const lines = paragraph.split('\n')
                          const firstLine = lines[0] || ''
                          const timestampMatch = firstLine.match(/^\[(\d+):(\d+)\]\s*(.*?)$/)

                          if (timestampMatch) {
                            const [, mins, secs, rest] = timestampMatch
                            const text = lines.length > 1 ? lines.slice(1).join(' ').trim() : ''
                            let speaker = null
                            let actualText = text

                            if (rest && rest.trim()) {
                              const restTrimmed = rest.trim()
                              if (text) {
                                speaker = restTrimmed
                              } else {
                                const looksLikeSpeaker =
                                  restTrimmed.length < 30 &&
                                  !restTrimmed.match(/[.!?]\s/) &&
                                  (restTrimmed[0] === restTrimmed[0].toUpperCase() || restTrimmed.startsWith('SPEAKER'))

                                if (looksLikeSpeaker) {
                                  speaker = restTrimmed
                                } else {
                                  actualText = restTrimmed
                                }
                              }
                            }

                            return (
                              <div key={idx} className="transcript-entry">
                                <div className="transcript-header">
                                  <TimestampLink timestamp={`${mins}:${secs}`} sourceUrl={content.source_url} />
                                  {speaker && speaker !== 'Unknown' && (
                                    <span className="transcript-speaker">{speaker}</span>
                                  )}
                                </div>
                                {actualText && (
                                  <div className="transcript-text">{actualText}</div>
                                )}
                              </div>
                            )
                          }

                          return (
                            <div key={idx} className="transcript-entry">
                              <div className="transcript-text">{paragraph}</div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>

    </div>
  )
}

export default ContentDetailModal
