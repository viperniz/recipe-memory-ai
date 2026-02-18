import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import axios from 'axios'
import { useAuth } from './AuthContext'
import { toast } from '../hooks/use-toast'
import { searchApi } from '../api/search'
import { tagsApi } from '../api/tags'

const API_BASE = import.meta.env.VITE_API_URL || '/api'

const DataContext = createContext(null)

export function DataProvider({ children }) {
  const { token } = useAuth()

  // --- API client ---
  const api = React.useMemo(() => {
    const client = axios.create({ baseURL: API_BASE })
    client.interceptors.request.use((config) => {
      if (token) {
        config.headers.Authorization = `Bearer ${token}`
      }
      return config
    })
    return client
  }, [token])

  // --- State ---
  const [libraryContents, setLibraryContents] = useState([])
  const [isLoadingLibrary, setIsLoadingLibrary] = useState(false)
  const [jobs, setJobs] = useState([])
  const [collections, setCollections] = useState([])
  const [collectionContents, setCollectionContents] = useState([])
  const [isLoadingCollectionContents, setIsLoadingCollectionContents] = useState(false)

  // Tags state
  const [tags, setTags] = useState([])
  const [tagContentMap, setTagContentMap] = useState({})

  // Search state (persists across navigation)
  const [searchResults, setSearchResults] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchFilters, setSearchFilters] = useState({})
  const [isSearching, setIsSearching] = useState(false)

  // --- Refs ---
  const previousJobStates = useRef(new Map())
  const hasInitialized = useRef(false)
  const libraryLoaded = useRef(false)
  const pollTimeoutRef = useRef(null)
  const isPollingRef = useRef(false)

  // --- Data methods ---

  const refreshLibrary = useCallback(async () => {
    if (!libraryLoaded.current) setIsLoadingLibrary(true)
    try {
      const res = await api.get('/library')
      setLibraryContents(res.data.contents || [])
      libraryLoaded.current = true
    } catch (err) {
      console.error('Failed to fetch library:', err)
    } finally {
      setIsLoadingLibrary(false)
    }
  }, [api])

  const refreshCollections = useCallback(async () => {
    try {
      const res = await api.get('/collections')
      setCollections(res.data.collections || [])
    } catch (err) {
      console.error('Failed to fetch collections:', err)
    }
  }, [api])

  const fetchCollectionContents = useCallback(async (collectionId) => {
    setIsLoadingCollectionContents(true)
    try {
      const res = await api.get(`/collections/${collectionId}/contents`)
      setCollectionContents(res.data.contents || [])
    } catch (err) {
      console.error('Failed to fetch collection contents:', err)
    } finally {
      setIsLoadingCollectionContents(false)
    }
  }, [api])

  const loadTags = useCallback(async () => {
    try {
      const [tagsRes, mapRes] = await Promise.all([
        api.get('/tags'),
        api.get('/tags/content-map'),
      ])
      setTags(tagsRes.data.tags || [])
      setTagContentMap(mapRes.data.content_map || {})
    } catch (err) {
      console.error('Failed to load tags:', err)
    }
  }, [api])

  const removeLibraryItem = useCallback((id) => {
    setLibraryContents(prev => prev.filter(c => c.id !== id))
  }, [])

  const updateJobStatus = useCallback((id, status) => {
    setJobs(prev => prev.map(j => j.id === id ? { ...j, status } : j))
  }, [])

  const removeJob = useCallback((id) => {
    setJobs(prev => prev.filter(j => j.id !== id))
  }, [])

  // --- Job polling ---

  const stopJobPolling = useCallback(() => {
    if (pollTimeoutRef.current) {
      clearTimeout(pollTimeoutRef.current)
      pollTimeoutRef.current = null
    }
    isPollingRef.current = false
  }, [])

  const pollJobs = useCallback(async () => {
    try {
      const res = await api.get('/jobs')
      const apiJobs = res.data.jobs || []

      // Merge API data with local state
      setJobs(prevJobs => {
        const apiJobMap = new Map(apiJobs.map(j => [j.id, j]))
        const mergedJobs = []
        const seenIds = new Set()

        for (const job of prevJobs) {
          if (apiJobMap.has(job.id)) {
            mergedJobs.push(apiJobMap.get(job.id))
          } else {
            mergedJobs.push(job)
          }
          seenIds.add(job.id)
        }

        for (const job of apiJobs) {
          if (!seenIds.has(job.id)) {
            mergedJobs.push(job)
          }
        }

        return mergedJobs
      })

      // Show notifications for status changes (skip on first load)
      if (hasInitialized.current) {
        apiJobs.forEach(job => {
          const prevState = previousJobStates.current.get(job.id)

          if (prevState && prevState !== 'completed' && job.status === 'completed') {
            toast({
              variant: 'success',
              title: 'Video ready',
              description: job.title || 'Processing complete',
              duration: 5000
            })
            refreshLibrary()
          }

          if (prevState && prevState !== 'failed' && job.status === 'failed') {
            toast({
              variant: 'destructive',
              title: 'Processing failed',
              description: job.error || 'An error occurred',
              duration: 8000
            })
          }
        })
      }

      apiJobs.forEach(job => {
        previousJobStates.current.set(job.id, job.status)
      })
      hasInitialized.current = true

      // Schedule next poll only if there are active (non-terminal) jobs
      const terminalStatuses = ['completed', 'failed', 'cancelled']
      const hasActive = apiJobs.some(j => !terminalStatuses.includes(j.status))

      if (hasActive) {
        pollTimeoutRef.current = setTimeout(pollJobs, 3000)
      } else {
        // No active jobs — stop polling
        isPollingRef.current = false
        pollTimeoutRef.current = null
      }
    } catch (err) {
      if (err.response?.status !== 401) {
        console.error('Failed to fetch jobs:', err)
      }
      // Retry after 10s on error
      pollTimeoutRef.current = setTimeout(pollJobs, 10000)
    }
  }, [api, refreshLibrary])

  const startJobPolling = useCallback(() => {
    if (isPollingRef.current) return
    isPollingRef.current = true
    pollJobs()
  }, [pollJobs])

  const addJob = useCallback((job) => {
    setJobs(prev => [job, ...prev])
    previousJobStates.current.set(job.id, job.status)
    // Kick off polling if idle
    if (!isPollingRef.current) {
      startJobPolling()
    }
  }, [startJobPolling])

  // --- Search methods ---
  const performSearch = useCallback(async (query, filters = {}) => {
    setSearchQuery(query)
    setSearchFilters(filters)

    if (!query && !filters.content_type && !filters.tag_ids?.length && !filters.has_notes) {
      setSearchResults(null)
      return
    }

    setIsSearching(true)
    try {
      const data = await searchApi.search(token, {
        query: query || null,
        content_type: filters.content_type || null,
        tag_ids: filters.tag_ids?.length ? filters.tag_ids : null,
        has_notes: filters.has_notes || null,
        n_results: 50
      })
      setSearchResults(data.results || [])
    } catch (err) {
      console.error('Search failed:', err)
      setSearchResults(null)
    } finally {
      setIsSearching(false)
    }
  }, [token])

  const clearSearch = useCallback(() => {
    setSearchQuery('')
    setSearchFilters({})
    setSearchResults(null)
  }, [])

  // --- Initial load on token ---
  useEffect(() => {
    if (!token) {
      // Reset everything on logout
      setLibraryContents([])
      setJobs([])
      setCollections([])
      setCollectionContents([])
      setTags([])
      setTagContentMap({})
      setSearchResults(null)
      setSearchQuery('')
      setSearchFilters({})
      libraryLoaded.current = false
      hasInitialized.current = false
      previousJobStates.current.clear()
      stopJobPolling()
      return
    }

    refreshLibrary()
    refreshCollections()
    loadTags()
    startJobPolling()

    return () => stopJobPolling()
  }, [token]) // eslint-disable-line react-hooks/exhaustive-deps

  // --- Context value ---
  const value = {
    libraryContents,
    isLoadingLibrary,
    jobs,
    collections,
    collectionContents,
    isLoadingCollectionContents,
    refreshLibrary,
    refreshCollections,
    fetchCollectionContents,
    addJob,
    removeJob,
    removeLibraryItem,
    updateJobStatus,
    startJobPolling,
    stopJobPolling,
    tags,
    tagContentMap,
    loadTags,
    searchResults,
    searchQuery,
    searchFilters,
    isSearching,
    performSearch,
    clearSearch,
  }

  return (
    <DataContext.Provider value={value}>
      {children}
    </DataContext.Provider>
  )
}

export function useData() {
  const context = useContext(DataContext)
  if (!context) {
    throw new Error('useData must be used within a DataProvider')
  }
  return context
}

export default DataContext
