import React, { useState, useEffect } from 'react'
import { Loader2, ChevronDown, ChevronRight, Network, Circle } from 'lucide-react'
import { Button } from '../ui/button'
import TimestampLink from './TimestampLink'
import UpgradePrompt from '../billing/UpgradePrompt'
import axios from 'axios'
import { toast } from '../../hooks/use-toast'

const API_BASE = import.meta.env.VITE_API_URL || '/api'

function MindMapNode({ node, sourceUrl, depth = 0 }) {
  const [expanded, setExpanded] = useState(depth < 2)
  const hasChildren = node.children && node.children.length > 0

  const importanceClass = node.importance
    ? `mindmap-importance-${node.importance}`
    : 'mindmap-importance-medium'

  return (
    <li className={`mindmap-node ${importanceClass}`}>
      <div className="mindmap-node-row" onClick={() => hasChildren && setExpanded(!expanded)}>
        <span className="mindmap-toggle">
          {hasChildren ? (
            expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />
          ) : (
            <Circle className="w-2 h-2" />
          )}
        </span>
        <span className="mindmap-node-label">{node.label}</span>
        {node.timestamp && (
          <TimestampLink timestamp={node.timestamp} sourceUrl={sourceUrl} />
        )}
      </div>
      {node.description && (
        <div className="mindmap-node-desc">{node.description}</div>
      )}
      {hasChildren && expanded && (
        <ul className="mindmap-children">
          {node.children.map((child, idx) => (
            <MindMapNode key={idx} node={child} sourceUrl={sourceUrl} depth={depth + 1} />
          ))}
        </ul>
      )}
    </li>
  )
}

function MindMapPanel({ contentId, sourceUrl }) {
  const [mindmap, setMindmap] = useState(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isLoadingStored, setIsLoadingStored] = useState(true)
  const [error, setError] = useState(null)

  // Load stored mindmap on mount
  useEffect(() => {
    const loadStored = async () => {
      try {
        const token = localStorage.getItem('token')
        const response = await axios.get(
          `${API_BASE}/content/${contentId}/generated/mindmap`,
          { headers: { Authorization: `Bearer ${token}` } }
        )
        if (response.data.data) {
          setMindmap(response.data.data)
        }
      } catch (err) {
        // Silently ignore
      } finally {
        setIsLoadingStored(false)
      }
    }
    loadStored()
  }, [contentId])

  const generate = async (regenerate = false) => {
    setIsGenerating(true)
    setError(null)
    try {
      const token = localStorage.getItem('token')
      const url = regenerate
        ? `${API_BASE}/content/${contentId}/mindmap?regenerate=true`
        : `${API_BASE}/content/${contentId}/mindmap`
      const response = await axios.post(
        url,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      )
      setMindmap(response.data.mindmap)
    } catch (err) {
      const detail = err.response?.data?.detail
      if (err.response?.status === 403 && typeof detail === 'object') {
        if (detail.error === 'feature_locked') {
          setError({ type: 'feature_locked', requiredTier: detail.required_tier, message: detail.message })
        } else if (detail.error === 'insufficient_credits') {
          setError({ type: 'credits', cost: detail.cost, balance: detail.balance })
        } else {
          toast({ variant: 'destructive', title: 'Access Denied', description: detail.message || 'Upgrade your plan.' })
        }
      } else {
        toast({ variant: 'destructive', title: 'Generation failed', description: typeof detail === 'string' ? detail : (detail?.message || err.message) })
      }
    } finally {
      setIsGenerating(false)
    }
  }

  if (error?.type === 'feature_locked') {
    return (
      <div className="mindmap-panel">
        <UpgradePrompt type="feature_locked" requiredTier={error.requiredTier} message={error.message} inline />
      </div>
    )
  }

  if (error?.type === 'credits') {
    return (
      <div className="mindmap-panel">
        <UpgradePrompt type="insufficient_credits" cost={error.cost} balance={error.balance} inline />
      </div>
    )
  }

  if (isLoadingStored) {
    return (
      <div className="mindmap-panel">
        <div className="mindmap-generate">
          <Loader2 className="w-6 h-6 animate-spin text-purple-500 mx-auto mb-3" />
          <p>Loading...</p>
        </div>
      </div>
    )
  }

  if (!mindmap) {
    return (
      <div className="mindmap-panel">
        <div className="mindmap-generate">
          <Network className="w-10 h-10 text-purple-500 mx-auto mb-3" />
          <p>Generate an interactive mind map from this source's key topics</p>
          <Button onClick={() => generate(false)} disabled={isGenerating}>
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              'Generate Mind Map'
            )}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="mindmap-panel">
      <ul className="mindmap-tree">
        <MindMapNode node={mindmap} sourceUrl={sourceUrl} depth={0} />
      </ul>
      <div className="flashcard-actions" style={{ marginTop: '1rem' }}>
        <Button variant="outline" size="sm" onClick={() => generate(true)} disabled={isGenerating}>
          {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Regenerate'}
        </Button>
      </div>
    </div>
  )
}

export default MindMapPanel
