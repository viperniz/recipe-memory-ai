import React, { useState, useEffect, useCallback } from 'react'
import axios from 'axios'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import { toast } from '../hooks/use-toast'
import { ToastAction } from '../components/ui/toast'
import { videoApi } from '../api/notes'

// Dashboard components
import Sidebar from '../components/dashboard/Sidebar'
import NewNoteTab from '../components/dashboard/NewNoteTab'
import LibraryTab from '../components/dashboard/LibraryTab'
import CollectionTab from '../components/dashboard/CollectionTab'

// AI Chat Widget
import AIChatWidget from '../components/chat/AIChatWidget'

// Layout
import AppNavbar from '../components/layout/AppNavbar'

// Content components
import ContentDetailModal from '../components/content/ContentDetailModal'

// Modal components
import ExportModal from '../components/modals/ExportModal'
import NewCollectionModal from '../components/modals/NewCollectionModal'
import AddToCollectionModal from '../components/modals/AddToCollectionModal'
import OnboardingModal from '../components/modals/OnboardingModal'
import { teamApi } from '../api/team'
import ConfirmModal from '../components/modals/ConfirmModal'

import { API_BASE } from '../lib/apiBase'

/**
 * Handle 403 errors: feature_locked, limit_reached, insufficient_credits.
 * Returns true if handled, false otherwise.
 */
const handle403Error = (err, navigate, toastFn) => {
  const errorDetail = err.response?.data?.detail
  if (err.response?.status !== 403 || !errorDetail || typeof errorDetail !== 'object') {
    return false
  }

  if (errorDetail.error === 'feature_locked') {
    const tierName = errorDetail.required_tier
      ? errorDetail.required_tier.charAt(0).toUpperCase() + errorDetail.required_tier.slice(1)
      : 'a higher'
    toastFn({
      variant: 'destructive',
      title: 'Feature Locked',
      description: errorDetail.message || `This feature requires ${tierName}+ plan.`,
      action: (
        <ToastAction altText="Upgrade" onClick={() => navigate('/pricing')}>
          Upgrade
        </ToastAction>
      ),
      duration: 8000
    })
    return true
  }

  if (errorDetail.error === 'limit_reached') {
    toastFn({
      variant: 'destructive',
      title: 'Limit Reached',
      description: errorDetail.message || 'You\'ve reached a limit on your current plan.',
      action: (
        <ToastAction altText="Upgrade" onClick={() => navigate('/pricing')}>
          Upgrade
        </ToastAction>
      ),
      duration: 8000
    })
    return true
  }

  if (errorDetail.error === 'insufficient_credits') {
    toastFn({
      variant: 'destructive',
      title: 'Usage Limit Reached',
      description: 'Not enough allowance remaining for this action.',
      action: (
        <ToastAction altText="Upgrade" onClick={() => navigate('/pricing')}>
          Upgrade
        </ToastAction>
      ),
      duration: 10000
    })
    return true
  }

  return false
}

const createApiClient = (getToken) => {
  const client = axios.create({ baseURL: API_BASE })

  // Add request interceptor to include token in every request
  client.interceptors.request.use(
    (config) => {
      const token = getToken()
      if (token) {
        config.headers.Authorization = `Bearer ${token}`
      }
      return config
    },
    (error) => {
      return Promise.reject(error)
    }
  )

  // Add response interceptor to handle auth errors
  client.interceptors.response.use(
    (response) => response,
    (error) => {
      // Don't interfere with auth endpoints or let errors propagate normally
      // The AuthContext and ProtectedRoute will handle authentication failures
      return Promise.reject(error)
    }
  )

  return client
}

function HomePage() {
  const { user, token, logout } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  // Data from context (persistent across route changes)
  const {
    libraryContents, isLoadingLibrary,
    jobs, collections,
    collectionContents, isLoadingCollectionContents,
    refreshLibrary, refreshCollections, fetchCollectionContents,
    addJob, removeJob, removeLibraryItem, updateJobStatus,
  } = useData()

  // API client for non-data endpoints (search, export, content detail, etc.)
  const api = React.useMemo(
    () => createApiClient(() => token),
    [token]
  )

  // Onboarding state
  const [showOnboarding, setShowOnboarding] = useState(false)

  useEffect(() => {
    document.title = 'Dashboard — Second Mind'
  }, [])

  // Show onboarding for new users with empty libraries
  useEffect(() => {
    if (user && !isLoadingLibrary && libraryContents.length === 0 && jobs.length === 0) {
      const key = `onboarding_completed_${user.id}`
      if (!localStorage.getItem(key)) {
        setShowOnboarding(true)
      }
    }
  }, [user, isLoadingLibrary, libraryContents.length, jobs.length])

  const handleOnboardingClose = () => {
    setShowOnboarding(false)
    if (user) {
      localStorage.setItem(`onboarding_completed_${user.id}`, 'true')
    }
  }

  const handleOnboardingTryVideo = (url) => {
    handleOnboardingClose()
    handleAddYoutube(url)
  }

  // Handle team invitation query param: /app?invite=TOKEN
  useEffect(() => {
    const inviteToken = searchParams.get('invite')
    if (inviteToken && token) {
      teamApi.acceptInvitation(token, inviteToken)
        .then(result => {
          toast({ variant: 'success', title: 'Team joined!', description: `You've joined ${result.team_name || 'the team'}` })
          navigate('/team', { replace: true })
        })
        .catch(err => {
          const detail = err.response?.data?.detail
          toast({ variant: 'destructive', title: 'Invitation error', description: typeof detail === 'string' ? detail : err.message })
        })
    }
  }, [searchParams, token]) // eslint-disable-line react-hooks/exhaustive-deps

  // Navigation state
  const [activeTab, setActiveTab] = useState('library')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  // Add video state
  const [isAddingVideo, setIsAddingVideo] = useState(false)

  // Add URL state
  const [isAddingUrl, setIsAddingUrl] = useState(false)

  // Content detail state
  const [selectedContent, setSelectedContent] = useState(null)
  const [isLoadingContent, setIsLoadingContent] = useState(false)

  // Settings state (analyzeFrames defaults off — Pro+ users can enable via toggle)
  const [settings, setSettings] = useState({
    provider: 'openai',
    analyzeFrames: false
  })

  // Export state
  const [showExportModal, setShowExportModal] = useState(false)
  const [confirmState, setConfirmState] = useState({ isOpen: false, title: '', message: '', onConfirm: null })
  const openConfirm = (title, message, onConfirm) => setConfirmState({ isOpen: true, title, message, onConfirm })
  const closeConfirm = () => setConfirmState(s => ({ ...s, isOpen: false, onConfirm: null }))
  const [exportFormat, setExportFormat] = useState('markdown')
  const [exportContentIds, setExportContentIds] = useState([])
  const [isExporting, setIsExporting] = useState(false)
  const [includeTranscript, setIncludeTranscript] = useState(true)

  // Collections UI state
  const [selectedCollectionId, setSelectedCollectionId] = useState(null)
  const [showNewCollectionModal, setShowNewCollectionModal] = useState(false)
  const [newCollectionName, setNewCollectionName] = useState('')
  const [newCollectionDesc, setNewCollectionDesc] = useState('')
  const [showAddToCollectionModal, setShowAddToCollectionModal] = useState(false)
  const [addToCollectionContentId, setAddToCollectionContentId] = useState(null)

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      const target = e.target
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable

      // Escape — close any open modal
      if (e.key === 'Escape') {
        if (selectedContent) { setSelectedContent(null); return }
        if (showExportModal) { setShowExportModal(false); return }
        if (showNewCollectionModal) { setShowNewCollectionModal(false); return }
        if (showAddToCollectionModal) { setShowAddToCollectionModal(false); return }
        if (showOnboarding) { handleOnboardingClose(); return }
      }

      // Ctrl+K or / (outside input) — focus search bar
      if ((e.key === 'k' && (e.ctrlKey || e.metaKey)) || (e.key === '/' && !isInput)) {
        e.preventDefault()
        setActiveTab('library')
        setTimeout(() => {
          const searchInput = document.querySelector('.search-bar-input, .library-search input, [data-search-input]')
          if (searchInput) searchInput.focus()
        }, 50)
        return
      }

      // N (outside input) — switch to Add Source tab
      if (e.key === 'n' && !isInput && !e.ctrlKey && !e.metaKey) {
        setActiveTab('new')
        return
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [selectedContent, showExportModal, showNewCollectionModal, showAddToCollectionModal, showOnboarding]) // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch collection contents when switching to collection tab
  useEffect(() => {
    if (activeTab === 'collection' && selectedCollectionId) {
      fetchCollectionContents(selectedCollectionId)
    }
  }, [activeTab, selectedCollectionId, fetchCollectionContents])

  // Event handlers
  const handleCardClick = async (contentId) => {
    setIsLoadingContent(true)
    try {
      const res = await api.get(`/content/${contentId}`)
      setSelectedContent(res.data.content)
    } catch (err) {
      console.error('Failed to fetch content:', err)
      toast({
        variant: 'destructive',
        title: 'Failed to load content',
        description: err.message
      })
    } finally {
      setIsLoadingContent(false)
    }
  }

  const handleDeleteContent = (contentId, title) => {
    openConfirm(
      'Delete content?',
      `"${title || 'this content'}" will be permanently removed from your knowledge base.`,
      async () => {
        closeConfirm()
        try {
          await api.delete(`/content/${contentId}`)
          removeLibraryItem(contentId)
          if (selectedContent?.id === contentId) {
            setSelectedContent(null)
          }
          toast({ variant: 'success', title: 'Content deleted' })
        } catch (err) {
          console.error('Failed to delete content:', err)
          toast({
            variant: 'destructive',
            title: 'Failed to delete content',
            description: err.response?.data?.detail || err.message
          })
        }
      }
    )
  }

  const handleCancelJob = async (job) => {
    try {
      await api.post(`/jobs/${job.id}/cancel`)
      updateJobStatus(job.id, 'cancelled')
      toast({ variant: 'default', title: 'Cancelled', description: 'Processing was cancelled.' })
    } catch (err) {
      console.error('Cancel failed:', err)
      toast({ variant: 'destructive', title: 'Cancel failed', description: err.response?.data?.detail || err.message })
    }
  }

  const handleRetryJob = async (job) => {
    try {
      const response = await api.post('/videos/add', {
        url_or_path: job.video_url,
        analyze_frames: settings.analyzeFrames,
        provider: settings.provider
      })
      const newJob = response.data.job
      if (newJob) {
        addJob(newJob)
      }
      setActiveTab('library')
      toast({ variant: 'success', title: 'Retrying', description: 'Video added to the queue again.' })
    } catch (err) {
      console.error('Retry failed:', err)
      toast({ variant: 'destructive', title: 'Retry failed', description: err.response?.data?.detail || err.message })
    }
  }

  const handleDismissJob = async (job) => {
    try {
      await api.delete(`/jobs/${job.id}`)
      removeJob(job.id)
      toast({ variant: 'default', title: 'Dismissed', description: 'Job removed from the list.' })
    } catch (err) {
      console.error('Dismiss failed:', err)
      toast({ variant: 'destructive', title: 'Dismiss failed', description: err.response?.data?.detail || err.message })
    }
  }

  const handleAddUrl = async (url, researchMode = false) => {
    if (!url.trim()) {
      toast({
        variant: 'warning',
        title: 'Missing URL',
        description: 'Please enter a web page URL'
      })
      return
    }
    setIsAddingUrl(true)
    try {
      const response = await api.post('/urls/add', {
        url: url.trim(),
        research_mode: researchMode
      })

      if (response.data.success) {
        toast({
          variant: 'success',
          title: 'Article imported',
          description: response.data.content?.title || 'Web content saved',
          action: (
            <ToastAction altText="View" onClick={() => {
              setActiveTab('library')
              refreshLibrary()
            }}>
              View
            </ToastAction>
          ),
          duration: 5000
        })
        // Refresh library
        refreshLibrary()
        setActiveTab('library')
      }
    } catch (err) {
      console.error('Failed to import URL:', err)
      if (!handle403Error(err, navigate, toast)) {
        const errorDetail = err.response?.data?.detail
        const status = err.response?.status
        let description = typeof errorDetail === 'string' ? errorDetail : err.message
        if (status === 500 || status === 422) {
          description = "This page couldn't be accessed. It may require login or block scrapers. Try a publicly accessible URL."
        }
        toast({
          variant: 'destructive',
          title: 'Failed to import article',
          description
        })
      }
    } finally {
      setIsAddingUrl(false)
    }
  }

  const handleAddYoutube = async (url, contentMode = 'general', language = null, cookies = null) => {
    if (!url.trim()) return
    setIsAddingVideo(true)
    try {
      const response = await api.post('/videos/add', {
        url_or_path: url.trim(),
        analyze_frames: settings.analyzeFrames,
        provider: settings.provider,
        mode: contentMode,
        language,
        cookies
      })
      const newJob = response.data.job
      if (newJob) {
        addJob(newJob)
        toast({
          variant: 'info',
          title: 'YouTube video queued',
          description: `${newJob.title || 'Video'} is now processing`,
          duration: 3000
        })
      }
      setActiveTab('library')
    } catch (err) {
      console.error('Failed to add YouTube video:', err)
      if (!handle403Error(err, navigate, toast)) {
        const errorDetail = err.response?.data?.detail
        toast({
          variant: 'destructive',
          title: 'Failed to add YouTube video',
          description: typeof errorDetail === 'string' ? errorDetail : err.message
        })
      }
    } finally {
      setIsAddingVideo(false)
    }
  }

  const handleUploadFile = async (file, contentMode = 'general', language = null, onProgress = null) => {
    if (!file) return
    setIsAddingVideo(true)
    try {
      const response = await videoApi.uploadVideo(token, file, {
        analyzeFrames: settings.analyzeFrames,
        provider: settings.provider,
        mode: contentMode,
        language,
        onProgress
      })

      const newJob = response.job
      if (newJob) {
        addJob(newJob)
        toast({
          variant: 'info',
          title: 'Upload complete',
          description: `${file.name} is now processing`,
          duration: 3000
        })
      }
      setActiveTab('library')
    } catch (err) {
      console.error('Failed to upload video:', err)
      if (!handle403Error(err, navigate, toast)) {
        const errorDetail = err.response?.data?.detail
        toast({
          variant: 'destructive',
          title: 'Failed to upload video',
          description: typeof errorDetail === 'string' ? errorDetail : err.message
        })
      }
    } finally {
      setIsAddingVideo(false)
    }
  }

  const handleAddVideoToCollection = async (url, collectionId) => {
    if (!url.trim()) return
    setIsAddingVideo(true)
    try {
      const payload = {
        url_or_path: url.trim(),
        analyze_frames: settings.analyzeFrames,
        provider: settings.provider,
        mode: 'general',
        collection_id: collectionId
      }
      const response = await api.post('/videos/add', payload)
      const newJob = response.data.job
      if (newJob) {
        addJob(newJob)
        toast({
          variant: 'info',
          title: 'Processing started',
          description: `${newJob.title || 'Video'} will be added to this collection`,
          duration: 3000
        })
      }
    } catch (err) {
      console.error('Failed to add video to collection:', err)
      if (!handle403Error(err, navigate, toast)) {
        const errorDetail = err.response?.data?.detail
        toast({
          variant: 'destructive',
          title: 'Failed to add video',
          description: typeof errorDetail === 'string' ? errorDetail : err.message
        })
      }
    } finally {
      setIsAddingVideo(false)
    }
  }

  const downloadBlob = (blob, filename) => {
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    window.URL.revokeObjectURL(url)
    document.body.removeChild(a)
  }

  const handleExport = async () => {
    setIsExporting(true)
    try {
      const payload = {
        content_ids: exportContentIds.length ? exportContentIds : [],
        format: exportFormat,
        include_transcript: includeTranscript
      }

      if (exportFormat === 'json') {
        const res = await api.post('/export', payload)
        const blob = new Blob([JSON.stringify(res.data.data, null, 2)], { type: 'application/json' })
        downloadBlob(blob, 'second-mind-export.json')
      } else {
        const res = await api.post('/export', payload, { responseType: 'blob' })
        const ext = exportFormat === 'txt' ? '.txt' : '.md'
        const filename = `second-mind-export${ext}`
        downloadBlob(res.data, filename)
      }
      setShowExportModal(false)
      toast({
        variant: 'success',
        title: 'Export complete',
        description: `Downloaded as ${exportFormat === 'txt' ? 'Plain text' : exportFormat === 'json' ? 'JSON' : 'Markdown'}`
      })
    } catch (err) {
      console.error('Export failed:', err)
      if (!handle403Error(err, navigate, toast)) {
        const errorDetail = err.response?.data?.detail
        const detail = err.response?.data instanceof Blob
          ? 'Export failed (no content or server error)'
          : (typeof errorDetail === 'string' ? errorDetail : err.message)
        toast({
          variant: 'destructive',
          title: 'Export failed',
          description: detail
        })
      }
    } finally {
      setIsExporting(false)
    }
  }

  const handleCreateCollection = async () => {
    if (!newCollectionName.trim()) return
    try {
      await api.post('/collections', {
        name: newCollectionName,
        description: newCollectionDesc
      })
      toast({
        variant: 'success',
        title: 'Collection created',
        description: newCollectionName
      })
      setNewCollectionName('')
      setNewCollectionDesc('')
      setShowNewCollectionModal(false)
      refreshCollections()
    } catch (err) {
      if (!handle403Error(err, navigate, toast)) {
        const errorDetail = err.response?.data?.detail
        toast({
          variant: 'destructive',
          title: 'Failed to create collection',
          description: typeof errorDetail === 'string' ? errorDetail : err.message
        })
      }
    }
  }

  const handleDeleteCollection = (collectionId) => {
    openConfirm(
      'Delete collection?',
      'This collection and its organization will be permanently removed.',
      async () => {
        closeConfirm()
        try {
          await api.delete(`/collections/${collectionId}`)
          refreshCollections()
          refreshLibrary()
          if (selectedCollectionId === collectionId) {
            setSelectedCollectionId(null)
            setActiveTab('library')
          }
          toast({ variant: 'success', title: 'Collection deleted' })
        } catch (err) {
          toast({
            variant: 'destructive',
            title: 'Failed to delete collection',
            description: err.response?.data?.detail || err.message
          })
        }
      }
    )
  }

  const handleAddToCollection = async (collectionId) => {
    if (!addToCollectionContentId) return
    try {
      await api.post(`/collections/${collectionId}/add`, {
        content_id: addToCollectionContentId
      })
      setShowAddToCollectionModal(false)
      setAddToCollectionContentId(null)
      if (selectedCollectionId === collectionId) {
        fetchCollectionContents(collectionId)
      }
      toast({
        variant: 'success',
        title: 'Added to collection'
      })
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Failed to add to collection',
        description: err.response?.data?.detail || err.message
      })
    }
  }

  const handleRemoveFromCollection = async (contentId) => {
    if (!selectedCollectionId) return
    try {
      await api.post(`/collections/${selectedCollectionId}/remove`, {
        content_id: contentId
      })
      fetchCollectionContents(selectedCollectionId)
      toast({
        variant: 'success',
        title: 'Removed from collection'
      })
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Failed to remove from collection',
        description: err.response?.data?.detail || err.message
      })
    }
  }

  const handleLogout = async () => {
    await logout()
    navigate('/')
  }

  const selectedCollection = collections.find(c => c.id === selectedCollectionId)

  return (
    <div className="app-layout">
      <AppNavbar user={user} onLogout={handleLogout} sidebarCollapsed={sidebarCollapsed} onToggleSidebar={() => setSidebarCollapsed(!sidebarCollapsed)} />

      <div className="app-body">
        <Sidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          collections={collections}
          selectedCollectionId={selectedCollectionId}
          setSelectedCollectionId={setSelectedCollectionId}
          onNewCollection={() => setShowNewCollectionModal(true)}
          onDeleteCollection={handleDeleteCollection}
          onCardClick={handleCardClick}
          collapsed={sidebarCollapsed}
        />

        <main id="main-content" className="main-content">
        {activeTab === 'new' && (
          <NewNoteTab
            isAddingVideo={isAddingVideo}
            onAddUrl={handleAddUrl}
            isAddingUrl={isAddingUrl}
            onUploadFile={handleUploadFile}
            onAddYoutube={handleAddYoutube}
            settings={settings}
            setSettings={setSettings}
          />
        )}

        {activeTab === 'library' && (
          <LibraryTab
            contents={libraryContents}
            isLoading={isLoadingLibrary}
            onCardClick={handleCardClick}
            onDeleteContent={handleDeleteContent}
            onAddToCollection={(contentId) => {
              setAddToCollectionContentId(contentId)
              setShowAddToCollectionModal(true)
            }}
            onExportAll={() => {
              setExportContentIds([])
              setShowExportModal(true)
            }}
            jobs={jobs}
            onCancelJob={handleCancelJob}
            onRetryJob={handleRetryJob}
            onDismissJob={handleDismissJob}
            onNavigate={setActiveTab}
          />
        )}

        {activeTab === 'collection' && selectedCollectionId && (
          <CollectionTab
            collection={selectedCollection}
            contents={collectionContents}
            isLoading={isLoadingCollectionContents}
            onCardClick={handleCardClick}
            onRemoveFromCollection={handleRemoveFromCollection}
            onBackToLibrary={() => {
              setSelectedCollectionId(null)
              setActiveTab('library')
            }}
            onAddVideo={handleAddVideoToCollection}
            isAddingVideo={isAddingVideo}
          />
        )}

        {/* Content Detail Modal */}
        {selectedContent && (
          <ContentDetailModal
            content={selectedContent}
            isLoading={isLoadingContent}
            onClose={() => setSelectedContent(null)}
            onExport={() => {
              setExportContentIds([selectedContent.id])
              setShowExportModal(true)
            }}
          />
        )}

        {/* Export Modal */}
        <ExportModal
          isOpen={showExportModal}
          onClose={() => setShowExportModal(false)}
          exportFormat={exportFormat}
          setExportFormat={setExportFormat}
          includeTranscript={includeTranscript}
          setIncludeTranscript={setIncludeTranscript}
          isExporting={isExporting}
          onExport={handleExport}
          itemCount={exportContentIds.length || libraryContents.length}
        />

        {/* New Collection Modal */}
        <NewCollectionModal
          isOpen={showNewCollectionModal}
          onClose={() => setShowNewCollectionModal(false)}
          name={newCollectionName}
          setName={setNewCollectionName}
          description={newCollectionDesc}
          setDescription={setNewCollectionDesc}
          onSubmit={handleCreateCollection}
        />

        {/* Add to Collection Modal */}
        <AddToCollectionModal
          isOpen={showAddToCollectionModal}
          onClose={() => setShowAddToCollectionModal(false)}
          collections={collections}
          onSelect={handleAddToCollection}
          onCreateNew={() => {
            setShowAddToCollectionModal(false)
            setShowNewCollectionModal(true)
          }}
        />

        {/* AI Chat Widget - Floating */}
        <ConfirmModal
        isOpen={confirmState.isOpen}
        title={confirmState.title}
        message={confirmState.message}
        confirmText="Delete"
        variant="danger"
        onConfirm={confirmState.onConfirm}
        onCancel={closeConfirm}
      />
      <AIChatWidget
          onContentClick={handleCardClick}
          collectionId={activeTab === 'collection' ? selectedCollectionId : null}
          collectionName={activeTab === 'collection' ? selectedCollection?.name : null}
          selectedContent={selectedContent}
        />

        {/* Onboarding Modal */}
        {showOnboarding && (
          <OnboardingModal
            onClose={handleOnboardingClose}
            onTryVideo={handleOnboardingTryVideo}
          />
        )}
        </main>
      </div>
    </div>
  )
}

export default HomePage
