import React, { useState, useRef } from 'react'
import { Plus, Loader2, Video, Globe, Search, GraduationCap, Mic, Users, FileText, Upload, X } from 'lucide-react'
import { Button } from '../ui/button'
import { Input } from '../ui/input'

const ALLOWED_EXTENSIONS = ['.mp4', '.mkv', '.webm', '.avi', '.mov']

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

function NewNoteTab({
  videoUrl,
  setVideoUrl,
  isAddingVideo,
  onAddVideo,
  onAddUrl,
  isAddingUrl,
  onUploadFile,
  userTier,
  settings,
  setSettings
}) {
  const [inputMode, setInputMode] = useState('video') // 'video' or 'web'
  const [webUrl, setWebUrl] = useState('')
  const [researchMode, setResearchMode] = useState(false)
  const [contentMode, setContentMode] = useState('general')
  const [language, setLanguage] = useState('auto')
  const [selectedFile, setSelectedFile] = useState(null)
  const [isDragging, setIsDragging] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(null)
  const fileInputRef = useRef(null)

  const isPaid = userTier && userTier !== 'free'

  const handleFileSelect = (file) => {
    if (!file) return
    const ext = '.' + file.name.split('.').pop().toLowerCase()
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return // silently reject invalid extensions
    }
    setSelectedFile(file)
    setVideoUrl('') // clear URL when file is selected
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

  const handleSubmit = () => {
    if (inputMode === 'video') {
      if (selectedFile) {
        onUploadFile(selectedFile, contentMode, language === 'auto' ? null : language, (pct) => setUploadProgress(pct))
      } else {
        onAddVideo(contentMode, language === 'auto' ? null : language)
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

  const isProcessing = isAddingVideo || isAddingUrl
  const hasInput = inputMode === 'video' ? (videoUrl.trim() || selectedFile) : webUrl.trim()

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
        </button>
        <button
          className={`mode-btn ${inputMode === 'web' ? 'active' : ''}`}
          onClick={() => setInputMode('web')}
          disabled={isProcessing}
        >
          <Globe className="w-4 h-4" />
          Article
        </button>
      </div>

      <div className="add-video-form">

        {inputMode === 'video' ? (
          <>
            {/* File Upload Drop Zone */}
            <div className="form-group">
              <label>Upload a video file</label>
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
                      <span className="selected-file-name">{selectedFile.name}</span>
                      <span className="selected-file-size">{formatFileSize(selectedFile.size)}</span>
                    </div>
                    {uploadProgress !== null && (
                      <span className="upload-progress">{uploadProgress}%</span>
                    )}
                    <button
                      className="file-remove-btn"
                      onClick={(e) => { e.stopPropagation(); clearFile() }}
                      disabled={isProcessing}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="drop-zone-prompt">
                    <Upload className="w-6 h-6" />
                    <span>Drag & drop a video file, or click to browse</span>
                    <span className="drop-zone-hint">.mp4, .mkv, .webm, .avi, .mov — up to 500 MB</span>
                  </div>
                )}
              </div>
            </div>

            {/* URL Input — only for paid users, below the file zone */}
            {isPaid ? (
              <div className="form-group">
                <label htmlFor="video-url">Or paste a video URL</label>
                <Input
                  id="video-url"
                  type="text"
                  placeholder="Paste any YouTube, Vimeo, or lecture URL..."
                  value={videoUrl}
                  onChange={(e) => { setVideoUrl(e.target.value); if (e.target.value) setSelectedFile(null) }}
                  onKeyPress={(e) => e.key === 'Enter' && handleSubmit()}
                  disabled={isProcessing || !!selectedFile}
                  className="font-mono"
                />
              </div>
            ) : (
              <div className="form-group">
                <p className="field-hint" style={{ marginTop: 4 }}>
                  YouTube downloads require a paid plan. Install the{' '}
                  <strong>Video Memory AI extension</strong> and upgrade to Starter to save YouTube videos.
                </p>
              </div>
            )}

            {/* Content Mode Selector — horizontal chips */}
            <div className="form-group">
              <label>Content type</label>
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
                      <span>{mode.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Language Selector */}
            <div className="form-group">
              <label>Translate & output to</label>
              <select
                className="language-select"
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                disabled={isProcessing}
              >
                <option value="auto">Auto-detect (keep original)</option>
                <optgroup label="Common">
                  <option value="en">English</option>
                  <option value="es">Spanish</option>
                  <option value="fr">French</option>
                  <option value="de">German</option>
                  <option value="pt">Portuguese</option>
                  <option value="zh">Chinese</option>
                  <option value="ja">Japanese</option>
                  <option value="ko">Korean</option>
                  <option value="ar">Arabic</option>
                  <option value="hi">Hindi</option>
                  <option value="ru">Russian</option>
                  <option value="it">Italian</option>
                  <option value="nl">Dutch</option>
                  <option value="tr">Turkish</option>
                </optgroup>
                <optgroup label="More languages">
                  <option value="af">Afrikaans</option>
                  <option value="am">Amharic</option>
                  <option value="az">Azerbaijani</option>
                  <option value="be">Belarusian</option>
                  <option value="bg">Bulgarian</option>
                  <option value="bn">Bengali</option>
                  <option value="bs">Bosnian</option>
                  <option value="ca">Catalan</option>
                  <option value="cs">Czech</option>
                  <option value="cy">Welsh</option>
                  <option value="da">Danish</option>
                  <option value="el">Greek</option>
                  <option value="et">Estonian</option>
                  <option value="fa">Persian</option>
                  <option value="fi">Finnish</option>
                  <option value="gl">Galician</option>
                  <option value="gu">Gujarati</option>
                  <option value="ha">Hausa</option>
                  <option value="he">Hebrew</option>
                  <option value="hr">Croatian</option>
                  <option value="hu">Hungarian</option>
                  <option value="hy">Armenian</option>
                  <option value="id">Indonesian</option>
                  <option value="is">Icelandic</option>
                  <option value="ka">Georgian</option>
                  <option value="kk">Kazakh</option>
                  <option value="km">Khmer</option>
                  <option value="kn">Kannada</option>
                  <option value="la">Latin</option>
                  <option value="lt">Lithuanian</option>
                  <option value="lv">Latvian</option>
                  <option value="mk">Macedonian</option>
                  <option value="ml">Malayalam</option>
                  <option value="mn">Mongolian</option>
                  <option value="mr">Marathi</option>
                  <option value="ms">Malay</option>
                  <option value="my">Myanmar</option>
                  <option value="ne">Nepali</option>
                  <option value="no">Norwegian</option>
                  <option value="pa">Punjabi</option>
                  <option value="pl">Polish</option>
                  <option value="ps">Pashto</option>
                  <option value="ro">Romanian</option>
                  <option value="sd">Sindhi</option>
                  <option value="si">Sinhala</option>
                  <option value="sk">Slovak</option>
                  <option value="sl">Slovenian</option>
                  <option value="so">Somali</option>
                  <option value="sq">Albanian</option>
                  <option value="sr">Serbian</option>
                  <option value="sv">Swedish</option>
                  <option value="sw">Swahili</option>
                  <option value="ta">Tamil</option>
                  <option value="te">Telugu</option>
                  <option value="tg">Tajik</option>
                  <option value="th">Thai</option>
                  <option value="tl">Tagalog</option>
                  <option value="uk">Ukrainian</option>
                  <option value="ur">Urdu</option>
                  <option value="uz">Uzbek</option>
                  <option value="vi">Vietnamese</option>
                  <option value="yi">Yiddish</option>
                  <option value="yo">Yoruba</option>
                  <option value="yue">Cantonese</option>
                </optgroup>
              </select>
              <span className="field-hint">
                {language === 'auto'
                  ? 'Language will be auto-detected. Transcript stays in original language.'
                  : 'Transcript and notes will be translated to this language.'}
              </span>
            </div>
          </>
        ) : (
          <>
            {/* Web URL Input */}
            <div className="form-group">
              <label htmlFor="web-url">Web Page URL</label>
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
            </div>

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
                <span>Research Mode</span>
                <span className="inline-hint">Extracts actionable tools, methods, and opportunities — not just a summary</span>
              </label>
            </div>
          </>
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
            </>
          ) : (
            <>
              <Plus className="w-4 h-4 mr-2" />
              Add to Knowledge Base
            </>
          )}
        </Button>
      </div>
    </div>
  )
}

export default NewNoteTab
