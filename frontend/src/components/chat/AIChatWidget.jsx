import React, { useState, useRef, useEffect, useCallback } from 'react'
import { MessageSquare, X, Send, Loader2, ChevronDown, Sparkles, FileText, Globe, Lock, Search, FolderOpen, Trash2 } from 'lucide-react'
import { billingApi } from '../../api/billing'
import { toast } from '../../hooks/use-toast'

function AIChatWidget({ onContentClick, collectionId, collectionName, selectedContent }) {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [webSearch, setWebSearch] = useState(false)
  const [chatLimit, setChatLimit] = useState(null)
  const [limitReached, setLimitReached] = useState(false)
  const [sessionId, setSessionId] = useState(null)
  const [showEndConfirm, setShowEndConfirm] = useState(false)
  const [isLoadingSession, setIsLoadingSession] = useState(false)
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)
  const prevContextRef = useRef(null)

  // Determine current context
  const contextKey = selectedContent
    ? `content:${selectedContent.id}`
    : collectionId
      ? `collection:${collectionId}`
      : 'global'

  // Parse scope info from contextKey (stable, no extra deps)
  const parseScopeFromKey = (key) => {
    if (key.startsWith('content:')) return { scope_type: 'content', scope_id: key.slice(8) }
    if (key.startsWith('collection:')) return { scope_type: 'collection', scope_id: key.slice(11) }
    return { scope_type: 'global', scope_id: null }
  }

  // Load session from DB when context changes
  useEffect(() => {
    if (prevContextRef.current !== null && prevContextRef.current !== contextKey) {
      setWebSearch(false)
    }
    prevContextRef.current = contextKey

    let stale = false

    // Load session from DB
    const loadSession = async () => {
      const token = localStorage.getItem('token')
      if (!token) return

      setIsLoadingSession(true)
      try {
        const { scope_type, scope_id } = parseScopeFromKey(contextKey)
        const params = new URLSearchParams({ scope_type })
        if (scope_id) params.append('scope_id', scope_id)

        console.log('[AIChatWidget] Loading session for:', contextKey)
        const response = await fetch(`/api/chat/sessions?${params}`, {
          headers: { Authorization: `Bearer ${token}` }
        })
        if (stale) return // context changed while we were fetching
        if (response.ok) {
          const data = await response.json()
          if (stale) return
          if (data.session) {
            console.log('[AIChatWidget] Restored', data.session.messages?.length, 'messages for', contextKey)
            setSessionId(data.session.id)
            setMessages(data.session.messages || [])
          } else {
            setSessionId(null)
            setMessages([])
          }
        } else {
          setSessionId(null)
          setMessages([])
        }
      } catch (err) {
        if (stale) return
        console.error('Failed to load chat session:', err)
        setSessionId(null)
        setMessages([])
      } finally {
        if (!stale) setIsLoadingSession(false)
      }
    }
    loadSession()

    return () => { stale = true }
  }, [contextKey])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus()
    }
    if (isOpen) {
      fetchChatLimits()
    }
  }, [isOpen])

  const fetchChatLimits = async () => {
    try {
      const token = localStorage.getItem('token')
      if (!token) return
      const data = await billingApi.getUsageLimits(token)
      if (data.chat) {
        setChatLimit(data.chat)
        setLimitReached(data.chat.limit !== -1 && data.chat.remaining <= 0)
      }
    } catch (err) {
      console.error('Failed to fetch chat limits:', err)
    }
  }

  // Persist messages to DB (fire-and-forget)
  // Takes scope explicitly to avoid stale closure issues
  const persistMessages = useCallback((newMessages, scope) => {
    const token = localStorage.getItem('token')
    if (!token || newMessages.length === 0) return

    fetch('/api/chat/sessions/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        scope_type: scope.scope_type,
        scope_id: scope.scope_id,
        messages: newMessages
      })
    }).then(res => {
      if (res.ok) return res.json()
    }).then(data => {
      if (data?.session_id) setSessionId(data.session_id)
    }).catch(err => {
      console.error('Failed to persist chat messages:', err)
    })
  }, [])

  // Build context-aware label and subtitle
  const getHeaderInfo = () => {
    if (selectedContent) {
      return {
        title: 'Second Mind',
        subtitle: selectedContent.title || 'This source',
        scope: 'content'
      }
    }
    if (collectionId) {
      return {
        title: 'Second Mind',
        subtitle: collectionName || 'This collection',
        scope: 'collection'
      }
    }
    return {
      title: 'Second Mind',
      subtitle: 'Searches across everything you\'ve saved',
      scope: 'global'
    }
  }

  const headerInfo = getHeaderInfo()

  const sendMessage = async () => {
    if (!input.trim() || isLoading || limitReached) return

    const userMessage = input.trim()
    setInput('')

    const userMsg = { role: 'user', content: userMessage, sources: [] }
    setMessages(prev => [...prev, userMsg])
    setIsLoading(true)

    try {
      const token = localStorage.getItem('token')

      // Build payload based on context
      const payload = { message: userMessage }
      if (selectedContent) {
        payload.content_ids = [selectedContent.id]
      } else if (collectionId) {
        payload.collection_id = collectionId
        if (webSearch) payload.web_search = true
      }
      console.log('[AIChatWidget] payload:', JSON.stringify(payload))

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => null)
        if (response.status === 403 && errorData?.detail?.type === 'chat_limit') {
          setLimitReached(true)
          setMessages(prev => [...prev, {
            role: 'assistant',
            content: `You've reached your daily chat limit (${errorData.detail.message}). Upgrade your plan for more queries.`,
            sources: [],
            isUpgrade: true
          }])
          if (chatLimit) setChatLimit({ ...chatLimit, remaining: 0 })
          return
        }
        throw new Error('Failed to get response')
      }

      const data = await response.json()

      const assistantMsg = {
        role: 'assistant',
        content: data.answer,
        sources: data.sources || []
      }
      setMessages(prev => [...prev, assistantMsg])

      // Persist the user + assistant message pair (capture scope at call time)
      persistMessages([userMsg, assistantMsg], parseScopeFromKey(contextKey))

      if (chatLimit && chatLimit.limit !== -1) {
        const newRemaining = chatLimit.remaining - 1
        setChatLimit({ ...chatLimit, used: chatLimit.used + 1, remaining: newRemaining })
        if (newRemaining <= 0) setLimitReached(true)
      }
    } catch (error) {
      console.error('Chat error:', error)
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        sources: []
      }])
    } finally {
      setIsLoading(false)
    }
  }

  const handleEndSession = async () => {
    if (!sessionId) return
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`/api/chat/sessions/${sessionId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      })
      if (response.ok) {
        setMessages([])
        setSessionId(null)
        setShowEndConfirm(false)
        toast({ title: 'Chat cleared', description: 'All messages have been deleted.' })
      }
    } catch (err) {
      console.error('Failed to end session:', err)
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to delete chat session.' })
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const handleSourceClick = (source) => {
    if (source.source_type === 'web') {
      window.open(source.content_id, '_blank', 'noopener')
    } else if (onContentClick) {
      onContentClick(source.content_id)
      setIsOpen(false)
    }
  }

  const getPlaceholder = () => {
    if (limitReached) return "Daily limit reached"
    if (selectedContent) return `Ask about "${(selectedContent.title || 'this source').slice(0, 30)}..."`
    if (collectionId) return `Ask about ${collectionName || 'this collection'}...`
    return "Ask about your research..."
  }

  const getEmptyStateText = () => {
    if (selectedContent) return `Ask me anything about "${selectedContent.title || 'this source'}". I'll answer using only this source.`
    if (collectionId) return `Ask me anything about the sources in "${collectionName || 'this collection'}". I'll only search within this collection.`
    return 'I can search, synthesize, and connect ideas across your entire knowledge base.'
  }

  const quickQuestions = selectedContent
    ? ["Summarize this", "What are the key points?", "List action items"]
    : collectionId
      ? ["Summarize this collection", "What topics are covered?", "Compare the content"]
      : ["What are the key themes across my research?", "Compare the ideas in my latest sources", "What gaps exist in what I've collected so far?", "Summarize everything I've saved on [topic]"]

  const getLimitText = () => {
    if (!chatLimit || chatLimit.limit === -1) return null
    return `${chatLimit.remaining} / ${chatLimit.limit} queries remaining today`
  }

  // Scope indicator color
  const scopeColor = selectedContent ? '#f59e0b' : collectionId ? '#06b6d4' : '#8b5cf6'

  return (
    <>
      {/* Floating Button */}
      <button
        className={`ai-chat-fab ${isOpen ? 'hidden' : ''}`}
        onClick={() => setIsOpen(true)}
        aria-label="Open Second Mind"
        style={headerInfo.scope !== 'global' ? { background: `linear-gradient(135deg, ${scopeColor}, #8b5cf6)` } : undefined}
      >
        <Sparkles className="w-6 h-6" />
      </button>

      {/* Chat Panel */}
      <div className={`ai-chat-panel ${isOpen ? 'open' : ''}`}>
        {/* Header */}
        <div className="ai-chat-header">
          <div className="ai-chat-header-info">
            <div className="ai-chat-avatar" style={{ background: `linear-gradient(135deg, ${scopeColor}, #8b5cf6)` }}>
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3>{headerInfo.title}</h3>
              <span style={{ color: scopeColor }}>{headerInfo.subtitle}</span>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            {messages.length > 0 && sessionId && (
              <button
                className="ai-chat-end-session"
                onClick={() => setShowEndConfirm(true)}
                aria-label="End chat session"
                title="Clear chat history"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            <button
              className="ai-chat-close"
              onClick={() => setIsOpen(false)}
              aria-label="Close chat"
            >
              <ChevronDown className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scope badge */}
        {headerInfo.scope !== 'global' && (
          <div className="ai-chat-scope-badge" style={{ borderColor: `${scopeColor}33`, background: `${scopeColor}11` }}>
            {selectedContent ? (
              <FileText className="w-3 h-3" style={{ color: scopeColor }} />
            ) : (
              <FolderOpen className="w-3 h-3" style={{ color: scopeColor }} />
            )}
            <span style={{ color: scopeColor }}>
              {selectedContent ? 'Scoped to this content' : `Scoped to "${collectionName}"`}
            </span>
          </div>
        )}

        {/* End Session Confirmation */}
        {showEndConfirm && (
          <div className="ai-chat-confirm-overlay">
            <div className="ai-chat-confirm-dialog">
              <p>This will permanently delete all messages in this chat. This cannot be undone.</p>
              <div className="ai-chat-confirm-actions">
                <button onClick={() => setShowEndConfirm(false)}>Cancel</button>
                <button className="destructive" onClick={handleEndSession}>End Session</button>
              </div>
            </div>
          </div>
        )}

        {/* Messages */}
        <div className="ai-chat-messages">
          {isLoadingSession ? (
            <div className="ai-chat-empty">
              <Loader2 className="w-6 h-6 animate-spin" style={{ color: '#a855f7' }} />
              <p>Loading chat history...</p>
            </div>
          ) : messages.length === 0 ? (
            <div className="ai-chat-empty">
              <div className="ai-chat-empty-icon">
                <Sparkles className="w-8 h-8" />
              </div>
              <h4>What are you working on?</h4>
              <p>{getEmptyStateText()}</p>
              <div className="ai-chat-quick-actions">
                {quickQuestions.map((q, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setInput(q)
                      inputRef.current?.focus()
                    }}
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {messages.map((message, index) => (
                <div key={index} className={`ai-chat-message ${message.role}`}>
                  {message.role === 'assistant' && (
                    <div className="ai-chat-message-avatar">
                      <Sparkles className="w-4 h-4" />
                    </div>
                  )}
                  <div className="ai-chat-message-content">
                    <div className="ai-chat-message-text">
                      {message.content}
                    </div>
                    {message.isUpgrade && (
                      <a
                        href="/pricing"
                        className="ai-chat-upgrade-link"
                        style={{ display: 'inline-block', marginTop: '8px', color: '#a855f7', fontWeight: 500, fontSize: '0.875rem' }}
                      >
                        Upgrade Plan →
                      </a>
                    )}
                    {message.sources && message.sources.length > 0 && (
                      <div className="ai-chat-sources">
                        {message.sources.map((source, idx) => (
                          <button
                            key={idx}
                            className={`ai-chat-source ${source.source_type === 'web' ? 'web' : ''}`}
                            onClick={() => handleSourceClick(source)}
                          >
                            {source.source_type === 'web' ? (
                              <Globe className="w-3 h-3" />
                            ) : (
                              <FileText className="w-3 h-3" />
                            )}
                            <span>{source.title}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="ai-chat-message assistant">
                  <div className="ai-chat-message-avatar">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div className="ai-chat-message-content">
                    <div className="ai-chat-typing">
                      <span></span>
                      <span></span>
                      <span></span>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="ai-chat-input-area">
          <div className="ai-chat-input-container">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={getPlaceholder()}
              rows={1}
              disabled={isLoading || limitReached}
            />
            {collectionId && !selectedContent && (
              <button
                className={`ai-chat-web-toggle ${webSearch ? 'active' : ''}`}
                onClick={() => setWebSearch(!webSearch)}
                title={webSearch ? 'Web search enabled' : 'Enable web search'}
              >
                <Search className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={sendMessage}
              disabled={!input.trim() || isLoading || limitReached}
              className="ai-chat-send"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : limitReached ? (
                <Lock className="w-4 h-4" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </button>
          </div>
          <div className="ai-chat-powered">
            {webSearch && <span style={{ color: '#67e8f9', marginRight: '8px' }}>+ Web</span>}
            {getLimitText() || 'Answers grounded in your saved sources \u2014 not the open internet'}
          </div>
        </div>
      </div>

      {/* Backdrop */}
      {isOpen && (
        <div
          className="ai-chat-backdrop"
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  )
}

export default AIChatWidget
