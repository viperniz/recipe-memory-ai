import React, { useState, useRef, useEffect } from 'react'
import { Send, Bot, User, Loader2, FileText, ExternalLink } from 'lucide-react'
import { Button } from '../ui/button'

const API_BASE = import.meta.env.VITE_API_URL || '/api'

function ChatTab({ onContentClick }) {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: 'Hi! I can answer questions about your saved content. Ask me anything about the videos, recipes, tutorials, or meetings you\'ve added.',
      sources: []
    }
  ])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return

    const userMessage = input.trim()
    setInput('')

    // Add user message
    setMessages(prev => [...prev, { role: 'user', content: userMessage, sources: [] }])
    setIsLoading(true)

    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`${API_BASE}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ message: userMessage })
      })

      if (!response.ok) {
        throw new Error('Failed to get response')
      }

      const data = await response.json()

      // Add assistant response
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: data.answer,
        sources: data.sources || []
      }])
    } catch (error) {
      console.error('Chat error:', error)
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        sources: []
      }])
    } finally {
      setIsLoading(false)
      inputRef.current?.focus()
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const handleSourceClick = (contentId) => {
    if (onContentClick) {
      onContentClick(contentId)
    }
  }

  return (
    <div className="chat-container">
      <div className="chat-header">
        <Bot className="w-6 h-6 text-purple-400" />
        <div>
          <h2>Ask AI</h2>
          <p>Get answers from your knowledge base</p>
        </div>
      </div>

      <div className="chat-messages">
        {messages.map((message, index) => (
          <div key={index} className={`chat-message ${message.role}`}>
            <div className="chat-message-avatar">
              {message.role === 'assistant' ? (
                <Bot className="w-5 h-5" />
              ) : (
                <User className="w-5 h-5" />
              )}
            </div>
            <div className="chat-message-content">
              <div className="chat-message-text">{message.content}</div>
              {message.sources && message.sources.length > 0 && (
                <div className="chat-sources">
                  <span className="chat-sources-label">Sources:</span>
                  {message.sources.map((source, idx) => (
                    <button
                      key={idx}
                      className="chat-source-tag"
                      onClick={() => handleSourceClick(source.content_id)}
                    >
                      <FileText className="w-3 h-3" />
                      {source.title}
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="chat-message assistant">
            <div className="chat-message-avatar">
              <Bot className="w-5 h-5" />
            </div>
            <div className="chat-message-content">
              <div className="chat-loading">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Searching your knowledge base...</span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="chat-input-container">
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask a question about your saved content..."
          className="chat-input"
          rows={1}
          disabled={isLoading}
        />
        <Button
          onClick={sendMessage}
          disabled={!input.trim() || isLoading}
          className="chat-send-btn"
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
        </Button>
      </div>

      <div className="chat-suggestions">
        <span>Try asking:</span>
        <button onClick={() => setInput('What recipes have I saved?')}>
          What recipes have I saved?
        </button>
        <button onClick={() => setInput('Summarize my latest video')}>
          Summarize my latest video
        </button>
        <button onClick={() => setInput('What action items do I have?')}>
          What action items do I have?
        </button>
      </div>
    </div>
  )
}

export default ChatTab
