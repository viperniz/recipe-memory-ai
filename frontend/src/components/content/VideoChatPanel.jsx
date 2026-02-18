import React, { useState, useRef, useEffect, useCallback } from 'react'
import { Send, Loader2, MessageSquare, Trash2 } from 'lucide-react'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import TimestampLink from './TimestampLink'
import UpgradePrompt from '../billing/UpgradePrompt'
import { toast } from '../../hooks/use-toast'
import axios from 'axios'

import { API_BASE } from '../../lib/apiBase'

function VideoChatPanel({ contentId, sourceUrl }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingSession, setIsLoadingSession] = useState(false)
  const [error, setError] = useState(null)
  const [sessionId, setSessionId] = useState(null)
  const [showEndConfirm, setShowEndConfirm] = useState(false)
  const messagesEndRef = useRef(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Load session from DB on mount
  useEffect(() => {
    const loadSession = async () => {
      const token = localStorage.getItem('token')
      if (!token || !contentId) return

      setIsLoadingSession(true)
      try {
        const params = new URLSearchParams({ scope_type: 'content', scope_id: contentId })
        const response = await fetch(`${API_BASE}/chat/sessions?${params}`, {
          headers: { Authorization: `Bearer ${token}` }
        })
        if (response.ok) {
          const data = await response.json()
          if (data.session) {
            setSessionId(data.session.id)
            setMessages(data.session.messages || [])
          }
        }
      } catch (err) {
        console.error('Failed to load chat session:', err)
      } finally {
        setIsLoadingSession(false)
      }
    }
    loadSession()
  }, [contentId])

  // Persist messages to DB (fire-and-forget)
  const persistMessages = useCallback((newMessages) => {
    const token = localStorage.getItem('token')
    if (!token || newMessages.length === 0) return

    fetch(`${API_BASE}/chat/sessions/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        scope_type: 'content',
        scope_id: contentId,
        messages: newMessages
      })
    }).then(res => {
      if (res.ok) return res.json()
    }).then(data => {
      if (data?.session_id) setSessionId(data.session_id)
    }).catch(err => {
      console.error('Failed to persist chat messages:', err)
    })
  }, [contentId])

  const sendMessage = async () => {
    const text = input.trim()
    if (!text || isLoading) return

    const userMsg = { role: 'user', content: text }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setIsLoading(true)
    setError(null)

    try {
      const token = localStorage.getItem('token')
      const response = await axios.post(
        `${API_BASE}/content/${contentId}/chat`,
        {
          message: text,
          conversation_history: messages
        },
        { headers: { Authorization: `Bearer ${token}` } }
      )
      const assistantMsg = { role: 'assistant', content: response.data.answer }
      setMessages(prev => [...prev, assistantMsg])

      // Persist the user + assistant message pair
      persistMessages([userMsg, assistantMsg])
    } catch (err) {
      const detail = err.response?.data?.detail
      if (err.response?.status === 403 && typeof detail === 'object' && detail.type === 'chat_limit') {
        setError('limit')
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, something went wrong. Please try again.' }])
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleEndSession = async () => {
    if (!sessionId) return
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`${API_BASE}/chat/sessions/${sessionId}`, {
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

  // Render message content, turning [MM:SS] patterns into TimestampLinks
  const renderContent = (text) => {
    const parts = text.split(/(\[\d{1,2}:\d{2}\])/)
    return parts.map((part, i) => {
      const match = part.match(/^\[(\d{1,2}:\d{2})\]$/)
      if (match) {
        return <TimestampLink key={i} timestamp={match[1]} sourceUrl={sourceUrl} />
      }
      return <span key={i}>{part}</span>
    })
  }

  if (error === 'limit') {
    return (
      <div className="video-chat-panel">
        <UpgradePrompt reason="chat_limit" inline />
      </div>
    )
  }

  return (
    <div className="video-chat-panel">
      {/* End Session Confirmation */}
      {showEndConfirm && (
        <div className="ai-chat-confirm-overlay" style={{ position: 'absolute', borderRadius: '8px' }}>
          <div className="ai-chat-confirm-dialog">
            <p>This will permanently delete all messages in this chat. This cannot be undone.</p>
            <div className="ai-chat-confirm-actions">
              <button onClick={() => setShowEndConfirm(false)}>Cancel</button>
              <button className="destructive" onClick={handleEndSession}>End Session</button>
            </div>
          </div>
        </div>
      )}

      {isLoadingSession ? (
        <div className="video-chat-empty">
          <Loader2 className="w-6 h-6 animate-spin" />
          <p>Loading chat history...</p>
        </div>
      ) : messages.length === 0 ? (
        <div className="video-chat-empty">
          <MessageSquare className="w-8 h-8" />
          <p>Interrogate this source</p>
          <p>Get answers grounded in the actual content — not AI hallucinations</p>
        </div>
      ) : (
        <div className="video-chat-messages">
          {messages.length > 0 && sessionId && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '0 8px 4px' }}>
              <button
                className="ai-chat-end-session"
                onClick={() => setShowEndConfirm(true)}
                title="Clear chat history"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
          {messages.map((msg, idx) => (
            <div key={idx} className={`video-chat-message ${msg.role}`}>
              <div className="video-chat-message-bubble">
                {msg.role === 'assistant' ? renderContent(msg.content) : msg.content}
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="video-chat-message assistant">
              <div className="video-chat-message-bubble">
                <Loader2 className="w-4 h-4 animate-spin" />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      )}

      <div className="video-chat-input-row">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
          placeholder="Ask anything about this source..."
          disabled={isLoading}
        />
        <Button onClick={sendMessage} disabled={isLoading || !input.trim()} size="sm">
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </Button>
      </div>
    </div>
  )
}

export default VideoChatPanel
