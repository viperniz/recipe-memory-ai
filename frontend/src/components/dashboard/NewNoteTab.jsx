import React, { useState, useRef } from 'react'
import { Plus, Loader2, Video, Globe, Search, GraduationCap, Mic, Users, FileText, Upload, X, Youtube, Chrome, ArrowRight, ExternalLink, RefreshCw, LogIn } from 'lucide-react'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { useNavigate } from 'react-router-dom'
import { useCreditBalance } from '../billing/FeatureGate'
import { useExtensionDetection, useCookieReadiness, requestExtensionCookies } from '../../hooks/useExtensionDetection'

const ALLOWED_EXTENSIONS = ['.mp4', '.mkv', '.webm', '.avi', '.mov']

// TODO: Replace with real Chrome Web Store URL after publishing the extension
const CHROME_EXTENSION_URL = 'https://chromewebstore.google.com/detail/video-memory-ai'

// Content modes with icons and descriptions
const CONTENT_MODES = [
  { id: 'general', label: 'General', icon: FileText, description: 'Standard summaries and key points' },
  { id: 'learn', label: 'Tutorial', icon: GraduationCap, description: 'Concepts, definitions, study notes' },
  { id: 'meeting', label: 'Lecture', icon: Users, description: 'Key arguments, takeaways, structure' },
  { id: 'creator', label: 'Podcast', icon: Mic, description: 'Quotes, clips, talking points' },
  { id: 'deepdive', label: 'Deep Dive', icon: Search, description: 'In-depth analysis and connections' },
  ]

function formatFileSize(bytes) {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function isValidYoutubeUrl(url) {
    if (!url) return false
    return /^https?:\/\/(www\.)?youtube\.com\/watch\?v=[\w-]+/.test(url) ||
          /^https?:\/\/youtu\.be\/[\w-]+/.test(url)
}

function NewNoteTab({ isAddingVideo, onAddUrl, isAddingUrl, onUploadFile, onAddYoutube, settings, setSettings }) {
    const [inputMode, setInputMode] = useState('video') // 'video' or 'web'
  const [webUrl, setWebUrl] = useState('')
    const [researchMode, setResearchMode] = useState(false)
    const [contentMode, setContentMode] = useState('general')
    const [language, setLanguage] = useState('auto')
    const [selectedFile, setSelectedFile] = useState(null)
    const [isDragging, setIsDragging] = useState(false)
    const [uploadProgress, setUploadProgress] = useState(null)
    const [youtubeUrl, setYoutubeUrl] = useState('')
    const [isAddingYoutube, setIsAddingYoutube] = useState(false)

  const fileInputRef = useRef(null)
    const navigate = useNavigate()
    const { tier, loading: tierLoading } = useCreditBalance()
    const { detected: extensionDetected, loading: extensionLoading } = useExtensionDetection()
    const { cookiesReady, cookiesLoading, recheckCookies } = useCookieReadiness(extensionDetected)
    const isPaid = tier !== 'free'

  const handleFileSelect = (file) => {
        if (!file) return
        const ext = '.' + file.name.split('.').pop().toLowerCase()
        if (!ALLOWED_EXTENSIONS.includes(ext)) {
                return // silently reject invalid extensions
        }
        setSelectedFile(file)
  }

  const handleDrop = (e) => {
        e.preventDefault()
        setIsDragging(false)
        const file = e.dataTransfer.files?.[0]
        if (file) handleFileSelect(file)
  }

  const handleDragOver = (e) => {
        e.preventDefault()
        setIsDragging(true)
  }

  const handleDragLeave = (e) => {
        e.preventDefault()
        setIsDragging(false)
  }

  const handleYoutubeSubmit = async () => {
        if (!isValidYoutubeUrl(youtubeUrl) || !onAddYoutube) return

        setIsAddingYoutube(true)
        try {
                const { cookies, error } = await requestExtensionCookies()
                if (error) {
                          console.warn('Cookie request warning:', error)
                }
                await onAddYoutube(
                          youtubeUrl,
                          contentMode,
                          language === 'auto' ? null : language,
                          cookies
                        )
                setYoutubeUrl('')
        } finally {
                setIsAddingYoutube(false)
        }
  }

  const handleSubmit = () => {
        if (inputMode === 'video') {
                if (selectedFile) {
                          onUploadFile(selectedFile, contentMode, language === 'auto' ? null : language, (pct) => setUploadProgress(pct))
                }
        } else {
                onAddUrl(webUrl, researchMode)
        }
  }

  const clearFile = () => {
        setSelectedFile(null)
        setUploadProgress(null)
        if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const isProcessing = isAddingVideo || isAddingUrl || isAddingYoutube
    const hasInput = inputMode === 'video'
      ? (!!selectedFile || (extensionDetected && cookiesReady && isValidYoutubeUrl(youtubeUrl)))
          : webUrl.trim()

  // Determine YouTube section state (4 states now)
  const showYoutubeLoading = tierLoading || extensionLoading
    const showPromoCard = !showYoutubeLoading && !isPaid
    const showInstallCard = !showYoutubeLoading && isPaid && !extensionDetected
    const showLoginCard = !showYoutubeLoading && isPaid && extensionDetected && !cookiesReady && !cookiesLoading
    const showYoutubeInput = !showYoutubeLoading && isPaid && extensionDetected && cookiesReady

  return (
        <div className="page">
          {/* Input Mode Toggle */}
              <div className="input-mode-toggle">
                      <button
                                  className={`mode-btn ${inputMode === 'video' ? 'active' : ''}`}
                                  onClick={() => setInputMode('video')}
                                  disabled={isProcessing}
                                >
                                <Video className="w-4 h-4" />
                                Video
                      </button>button>
                      <button
                                  className={`mode-btn ${inputMode === 'web' ? 'active' : ''}`}
                                  onClick={() => setInputMode('web')}
                                  disabled={isProcessing}
                                >
                                <Globe className="w-4 h-4" />
                                Article
                      </button>button>
              </div>div>
        
              <div className="add-video-form">
                {inputMode === 'video' ? (
                    <>
                      {/* File Upload Drop Zone */}
                                <div className="form-group">
                                              <label>Upload a video file</label>label>
                                              <div
                                                                className={`file-drop-zone ${isDragging ? 'dragging' : ''} ${selectedFile ? 'has-file' : ''}`}
                                                                onDrop={handleDrop}
                                                                onDragOver={handleDragOver}
                                                                onDragLeave={handleDragLeave}
                                                                onClick={() => !selectedFile && fileInputRef.current?.click()}
                                                              >
                                                              <input
                                                                                  ref={fileInputRef}
                                                                                  type="file"
                                                                                  accept={ALLOWED_EXTENSIONS.join(',')}
                                                                                  onChange={(e) => handleFileSelect(e.target.files?.[0])}
                                                                                  style={{ display: 'none' }}
                                                                                />
                                                {selectedFile ? (
                                                                                  <div className="selected-file-info">
                                                                                                      <Video className="w-5 h-5" />
                                                                                                      <div className="selected-file-details">
                                                                                                                            <span className="selected-file-name">{selectedFile.name}</span>span>
                                                                                                                            <span className="selected-file-size">{formatFileSize(selectedFile.size)}</span>span>
                                                                                                        </div>div>
                                                                                    {uploadProgress !== null && (
                                                                                                          <span className="upload-progress">{uploadProgress}%</span>span>
                                                                                                      )}
                                                                                                      <button
                                                                                                                              className="file-remove-btn"
                                                                                                                              onClick={(e) => { e.stopPropagation(); clearFile() }}
                                                                                                                              disabled={isProcessing}
                                                                                                                            >
                                                                                                                            <X className="w-4 h-4" />
                                                                                                        </button>button>
                                                                                    </div>div>
                                                                                ) : (
                                                                                  <div className="drop-zone-prompt">
                                                                                                      <Upload className="w-6 h-6" />
                                                                                                      <span>Drag & drop a video file, or click to browse</span>span>
                                                                                                      <span className="drop-zone-hint">.mp4, .mkv, .webm, .avi, .mov — up to 500 MB</span>span>
                                                                                    </div>div>
                                                              )}
                                              </div>div>
                                </div>div>
                    
                      {/* YouTube Section — 4 states */}
                      {showPromoCard && (
                                    <div className="youtube-promo-card">
                                                    <div className="youtube-card-icon">
                                                                      <Youtube className="w-5 h-5" />
                                                    </div>div>
                                                    <div className="youtube-card-body">
                                                                      <strong>Save YouTube Videos</strong>strong>
                                                                      <p>Install our Chrome extension and upgrade your plan to save YouTube videos directly to your knowledge base.</p>p>
                                                    </div>div>
                                                    <Button variant="outline" size="sm" onClick={() => navigate('/pricing')}>
                                                                      Upgrade <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                                                    </Button>Button>
                                    </div>div>
                                )}
                    
                      {showInstallCard && (
                                    <div className="extension-install-card">
                                                    <div className="youtube-card-icon chrome">
                                                                      <Chrome className="w-5 h-5" />
                                                    </div>div>
                                                    <div className="youtube-card-body">
                                                                      <strong>Install the Chrome Extension</strong>strong>
                                                                      <p>Add the Video Memory AI extension to save YouTube videos with one click.</p>p>
                                                    </div>div>
                                                    <Button variant="outline" size="sm" onClick={() => window.open(CHROME_EXTENSION_URL, '_blank')}>
                                                                      Install <ExternalLink className="w-3.5 h-3.5 ml-1.5" />
                                                    </Button>Button>
                                    </div>div>
                                )}
                    
                      {showLoginCard && (
                                    <div className="extension-install-card">
                                                    <div className="youtube-card-icon">
                                                                      <LogIn className="w-5 h-5" />
                                                    </div>div>
                                                    <div className="youtube-card-body">
                                                                      <strong>Log into YouTube</strong>strong>
                                                                      <p>Sign into YouTube in this browser so the extension can access your cookies for downloading videos.</p>p>
                                                    </div>div>
                                                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                                                      <Button
                                                                                            variant="outline"
                                                                                            size="sm"
                                                                                            onClick={() => window.open('https://www.youtube.com', '_blank')}
                                                                                          >
                                                                                          Open YouTube <ExternalLink className="w-3.5 h-3.5 ml-1.5" />
                                                                      </Button>Button>
                                                                      <Button
                                                                                            variant="ghost"
                                                                                            size="sm"
                                                                                            onClick={recheckCookies}
                                                                                            disabled={cookiesLoading}
                                                                                          >
                                                                        {cookiesLoading ? (
                                                                                                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                                                                                ) : (
                                                                                                                  <RefreshCw className="w-3.5 h-3.5" />
                                                                                                                )}
                                                                      </Button>Button>
                                                    </div>div>
                                    </div>div>
                                )}
                    
                      {cookiesLoading && isPaid && extensionDetected && !cookiesReady && (
                                    <div className="extension-install-card">
                                                    <div className="youtube-card-icon">
                                                                      <Loader2 className="w-5 h-5 animate-spin" />
                                                    </div>div>
                                                    <div className="youtube-card-body">
                                                                      <strong>Checking YouTube access...</strong>strong>
                                                                      <p>Verifying cookie availability from the extension.</p>p>
                                                    </div>div>
                                    </div>div>
                                )}
                    
                      {showYoutubeInput && (
                                    <div className="youtube-url-section">
                                                    <label>Or paste a YouTube URL</label>label>
                                                    <div className="youtube-url-input-row">
                                                                      <Input
                                                                                            type="text"
                                                                                            placeholder="https://youtube.com/watch?v=..."
                                                                                            value={youtubeUrl}
                                                                                            onChange={(e) => setYoutubeUrl(e.target.value)}
                                                                                            onKeyDown={(e) => e.key === 'Enter' && handleYoutubeSubmit()}
                                                                                            disabled={isProcessing}
                                                                                            className="font-mono"
                                                                                          />
                                                                      <Button
                                                                                            onClick={handleYoutubeSubmit}
                                                                                            disabled={isProcessing || !isValidYoutubeUrl(youtubeUrl)}
                                                                                            size="sm"
                                                                                          >
                                                                        {isAddingYoutube ? (
                                                                                                                  <Loader2 className="w-4 h-4 animate-spin" />
                                                                                                                ) : (
                                                                                                                  <Plus className="w-4 h-4" />
                                                                                                                )}
                                                                      </Button>Button>
                                                    </div>div>
                                    </div>div>
                                )}
                    
                      {/* Content Mode Selector — horizontal chips */}
                                <div className="form-group">
                                              <label>Content type</label>label>
                                              <div className="mode-chips">
                                                {CONTENT_MODES.map((mode) => {
                                        const Icon = mode.icon
                                                            return (
                                                                                  <button
                                                                                                          key={mode.id}
                                                                                                          type="button"
                                                                                                          className={`mode-chip ${contentMode === mode.id ? 'active' : ''}`}
                                                                                                          onClick={() => setContentMode(mode.id)}
                                                                                                          disabled={isProcessing}
                                                                                                          title={mode.description}
                                                                                                        >
                                                                                                        <Icon className="w-4 h-4" />
                                                                                                        <span>{mode.label}</span>span>
                                                                                    </button>button>
                                                                                )
                                                })}
                                              </div>div>
                                </div>div>
                    
                      {/* Language Selector */}
                                <div className="form-group">
                                              <label>Translate & output to</label>label>
                                              <select
                                                                className="language-select"
                                                                value={language}
                                                                onChange={(e) => setLanguage(e.target.value)}
                                                                disabled={isProcessing}
                                                              >
                                                              <option value="auto">Auto-detect (keep original)</option>option>
                                                              <optgroup label="Common">
                                                                                <option value="en">English</option>option>
                                                                                <option value="es">Spanish</option>option>
                                                                                <option value="fr">French</option>option>
                                                                                <option value="de">German</option>option>
                                                                                <option value="pt">Portuguese</option>option>
                                                                                <option value="zh">Chinese</option>option>
                                                                                <option value="ja">Japanese</option>option>
                                                                                <option value="ko">Korean</option>option>
                                                                                <option value="ar">Arabic</option>option>
                                                                                <option value="hi">Hindi</option>option>
                                                                                <option value="ru">Russian</option>option>
                                                                                <option value="it">Italian</option>option>
                                                                                <option value="nl">Dutch</option>option>
                                                                                <option value="tr">Turkish</option>option>
                                                              </optgroup>optgroup>
                                                              <optgroup label="More languages">
                                                                                <option value="af">Afrikaans</option>option>
                                                                                <option value="am">Amharic</option>option>
                                                                                <option value="az">Azerbaijani</option>option>
                                                                                <option value="be">Belarusian</option>option>
                                                                                <option value="bg">Bulgarian</option>option>
                                                                                <option value="bn">Bengali</option>option>
                                                                                <option value="bs">Bosnian</option>option>
                                                                                <option value="ca">Catalan</option>option>
                                                                                <option value="cs">Czech</option>option>
                                                                                <option value="cy">Welsh</option>option>
                                                                                <option value="da">Danish</option>option>
                                                                                <option value="el">Greek</option>option>
                                                                                <option value="et">Estonian</option>option>
                                                                                <option value="fa">Persian</option>option>
                                                                                <option value="fi">Finnish</option>option>
                                                                                <option value="gl">Galician</option>option>
                                                                                <option value="gu">Gujarati</option>option>
                                                                                <option value="ha">Hausa</option>option>
                                                                                <option value="he">Hebrew</option>option>
                                                                                <option value="hr">Croatian</option>option>
                                                                                <option value="hu">Hungarian</option>option>
                                                                                <option value="hy">Armenian</option>option>
                                                                                <option value="id">Indonesian</option>option>
                                                                                <option value="is">Icelandic</option>option>
                                                                                <option value="ka">Georgian</option>option>
                                                                                <option value="kk">Kazakh</option>option>
                                                                                <option value="km">Khmer</option>option>
                                                                                <option value="kn">Kannada</option>option>
                                                                                <option value="la">Latin</option>option>
                                                                                <option value="lt">Lithuanian</option>option>
                                                                                <option value="lv">Latvian</option>option>
                                                                                <option value="mk">Macedonian</option>option>
                                                                                <option value="ml">Malayalam</option>option>
                                                                                <option value="mn">Mongolian</option>option>
                                                                                <option value="mr">Marathi</option>option>
                                                                                <option value="ms">Malay</option>option>
                                                                                <option value="my">Myanmar</option>option>
                                                                                <option value="ne">Nepali</option>option>
                                                                                <option value="no">Norwegian</option>option>
                                                                                <option value="pa">Punjabi</option>option>
                                                                                <option value="pl">Polish</option>option>
                                                                                <option value="ps">Pashto</option>option>
                                                                                <option value="ro">Romanian</option>option>
                                                                                <option value="sd">Sindhi</option>option>
                                                                                <option value="si">Sinhala</option>option>
                                                                                <option value="sk">Slovak</option>option>
                                                                                <option value="sl">Slovenian</option>option>
                                                                                <option value="so">Somali</option>option>
                                                                                <option value="sq">Albanian</option>option>
                                                                                <option value="sr">Serbian</option>option>
                                                                                <option value="sv">Swedish</option>option>
                                                                                <option value="sw">Swahili</option>option>
                                                                                <option value="ta">Tamil</option>option>
                                                                                <option value="te">Telugu</option>option>
                                                                                <option value="tg">Tajik</option>option>
                                                                                <option value="th">Thai</option>option>
                                                                                <option value="tl">Tagalog</option>option>
                                                                                <option value="uk">Ukrainian</option>option>
                                                                                <option value="ur">Urdu</option>option>
                                                                                <option value="uz">Uzbek</option>option>
                                                                                <option value="vi">Vietnamese</option>option>
                                                                                <option value="yi">Yiddish</option>option>
                                                                                <option value="yo">Yoruba</option>option>
                                                                                <option value="yue">Cantonese</option>option>
                                                              </optgroup>optgroup>
                                              </select>select>
                                              <span className="field-hint">
                                                {language === 'auto'
                                                                    ? 'Language will be auto-detected. Transcript stays in original language.'
                                                                    : 'Transcript and notes will be translated to this language.'}
                                              </span>span>
                                </div>div>
                    </>>
                  ) : (
                    <>
                      {/* Web URL Input */}
                                <div className="form-group">
                                              <label htmlFor="web-url">Web Page URL</label>label>
                                              <Input
                                                                id="web-url"
                                                                type="text"
                                                                placeholder="https://example.com/article..."
                                                                value={webUrl}
                                                                onChange={(e) => setWebUrl(e.target.value)}
                                                                onKeyPress={(e) => e.key === 'Enter' && handleSubmit()}
                                                                disabled={isProcessing}
                                                                className="font-mono"
                                                              />
                                </div>div>
                    
                      {/* Research Mode Toggle */}
                                <div className="inline-settings">
                                              <label className="research-toggle">
                                                              <input
                                                                                  type="checkbox"
                                                                                  checked={researchMode}
                                                                                  onChange={(e) => setResearchMode(e.target.checked)}
                                                                                  disabled={isProcessing}
                                                                                />
                                                              <Search className="w-4 h-4" />
                                                              <span>Research Mode</span>span>
                                                              <span className="inline-hint">Extracts actionable tools, methods, and opportunities — not just a summary</span>span>
                                              </label>label>
                                </div>div>
                    </>>
                  )}
              
                      <Button
                                  onClick={handleSubmit}
                                  className="w-full"
                                  disabled={isProcessing || !hasInput}
                                  size="lg"
                                >
                        {isProcessing ? (
                                              <>
                                                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                                {uploadProgress !== null ? `Uploading ${uploadProgress}%...` : 'Processing...'}
                                              </>>
                                            ) : (
                                              <>
                                                            <Plus className="w-4 h-4 mr-2" />
                                                            Add to Knowledge Base
                                              </>>
                                            )}
                      </Button>Button>
              </div>div>
        </div>div>
      )
}

export default NewNoteTab</></></></></div>
