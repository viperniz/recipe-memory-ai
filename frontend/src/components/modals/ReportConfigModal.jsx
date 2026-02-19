import React, { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useData } from '../../context/DataContext'
import { billingApi } from '../../api/billing'
import { reportsApi } from '../../api/reports'
import { toast } from '../../hooks/use-toast'
import {
  X, FileText, Code, Film, Briefcase, Lock,
  Globe, Plus, Trash2, Loader2, Coins, Sparkles,
  ClipboardList, Grid2X2
} from 'lucide-react'

const REPORT_TYPES = [
  {
    id: 'executive_brief',
    label: 'Executive Brief',
    description: 'Concise decision document with options & recommendations',
    icon: Briefcase,
    color: '#22c55e',
    minTier: 'starter',
  },
  {
    id: 'thesis',
    label: 'Thesis',
    description: 'Academic analysis with arguments, evidence & conclusions',
    icon: FileText,
    color: '#a855f7',
    minTier: 'pro',
  },
  {
    id: 'development_plan',
    label: 'Development Plan',
    description: 'Technical roadmap with phases, risks & milestones',
    icon: Code,
    color: '#3b82f6',
    minTier: 'pro',
  },
  {
    id: 'script',
    label: 'Script',
    description: 'Video/podcast script with hook, sections & CTA',
    icon: Film,
    color: '#f97316',
    minTier: 'pro',
  },
  {
    id: 'prd',
    label: 'PRD',
    description: 'Product requirements with user stories, specs & acceptance criteria',
    icon: ClipboardList,
    color: '#06b6d4',
    minTier: 'pro',
  },
  {
    id: 'swot',
    label: 'SWOT Analysis',
    description: 'Strengths, weaknesses, opportunities & threats framework',
    icon: Grid2X2,
    color: '#eab308',
    minTier: 'starter',
  },
]

const TIER_ORDER = ['free', 'starter', 'pro', 'team']

function tierMeetsMinimum(userTier, minTier) {
  return TIER_ORDER.indexOf(userTier) >= TIER_ORDER.indexOf(minTier)
}

function ReportConfigModal({ isOpen, onClose, collectionId, contentIds: initialContentIds }) {
  const { token } = useAuth()
  const { collections, libraryContents } = useData()
  const [subscription, setSubscription] = useState(null)
  const [selectedType, setSelectedType] = useState(null)
  const [selectedCollectionId, setSelectedCollectionId] = useState(collectionId || '')
  const [title, setTitle] = useState('')
  const [focusArea, setFocusArea] = useState('')
  const [webEnrichment, setWebEnrichment] = useState(false)
  const [manualUrls, setManualUrls] = useState([''])
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (!isOpen || !token) return
    billingApi.getSubscription(token).then(setSubscription).catch(() => {})
  }, [isOpen, token])

  useEffect(() => {
    if (isOpen) {
      setSelectedCollectionId(collectionId || '')
      setSelectedType(null)
      setTitle('')
      setFocusArea('')
      setWebEnrichment(false)
      setManualUrls([''])
    }
  }, [isOpen, collectionId])

  if (!isOpen) return null

  const tier = subscription?.tier || 'free'
  const creditBalance = subscription?.credit_balance ?? 0

  // Count sources
  let sourceCount = 0
  if (initialContentIds?.length) {
    sourceCount = initialContentIds.length
  } else if (selectedCollectionId) {
    const coll = collections.find(c => c.id === selectedCollectionId)
    sourceCount = coll?.content_count || (libraryContents || []).filter(c =>
      (c.collections || []).includes(selectedCollectionId)
    ).length || 1
  }

  // Credit calculation
  const baseCost = 5
  const sourceCost = Math.max(0, sourceCount - 1) * 1
  const webCost = webEnrichment ? 3 : 0
  const totalCost = baseCost + sourceCost + webCost
  const hasEnoughCredits = creditBalance >= totalCost

  const addUrl = () => setManualUrls([...manualUrls, ''])
  const removeUrl = (idx) => setManualUrls(manualUrls.filter((_, i) => i !== idx))
  const updateUrl = (idx, val) => {
    const updated = [...manualUrls]
    updated[idx] = val
    setManualUrls(updated)
  }

  const handleSubmit = async () => {
    if (!selectedType) {
      toast({ variant: 'destructive', title: 'Select a report type' })
      return
    }
    if (!selectedCollectionId && !initialContentIds?.length) {
      toast({ variant: 'destructive', title: 'Select a source collection' })
      return
    }
    if (!hasEnoughCredits) {
      toast({ variant: 'destructive', title: 'Insufficient credits', description: `Need ${totalCost}, have ${creditBalance}` })
      return
    }

    setIsSubmitting(true)
    try {
      const config = {
        report_type: selectedType,
        web_enrichment: webEnrichment,
        manual_urls: webEnrichment ? manualUrls.filter(u => u.trim()) : [],
        focus_area: focusArea || undefined,
        title: title || undefined,
      }
      if (initialContentIds?.length) {
        config.content_ids = initialContentIds
      } else {
        config.collection_id = selectedCollectionId
      }

      const result = await reportsApi.generateReport(token, config)
      toast({
        title: 'Report generation started',
        description: `"${result.title}" is being generated (~${result.estimated_credits} credits)`
      })
      onClose()
    } catch (err) {
      const detail = err.response?.data?.detail
      if (detail?.error === 'feature_locked') {
        toast({
          variant: 'destructive',
          title: 'Feature locked',
          description: detail.message || `Requires ${detail.required_tier} plan`
        })
      } else if (detail?.error === 'insufficient_credits') {
        toast({
          variant: 'destructive',
          title: 'Insufficient credits',
          description: detail.message
        })
      } else {
        toast({
          variant: 'destructive',
          title: 'Failed to start report',
          description: typeof detail === 'string' ? detail : (detail?.message || err.message)
        })
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content report-config-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2><Sparkles className="inline-block w-5 h-5 mr-2" />Generate Report</h2>
          <button className="modal-close" onClick={onClose}><X className="w-5 h-5" /></button>
        </div>

        <div className="modal-body">
          {/* Source Selection */}
          {!initialContentIds?.length && (
            <div className="report-section">
              <label className="report-label">Source Collection</label>
              <select
                className="report-select"
                value={selectedCollectionId}
                onChange={e => setSelectedCollectionId(e.target.value)}
              >
                <option value="">Select a collection...</option>
                {collections.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              {sourceCount > 0 && (
                <span className="report-source-count">{sourceCount} source{sourceCount !== 1 ? 's' : ''}</span>
              )}
            </div>
          )}
          {initialContentIds?.length > 0 && (
            <div className="report-section">
              <label className="report-label">Sources</label>
              <span className="report-source-count">{initialContentIds.length} content item{initialContentIds.length !== 1 ? 's' : ''} selected</span>
            </div>
          )}

          {/* Report Type */}
          <div className="report-section">
            <label className="report-label">Report Type</label>
            <div className="report-type-grid">
              {REPORT_TYPES.map(rt => {
                const Icon = rt.icon
                const locked = !tierMeetsMinimum(tier, rt.minTier)
                const isSelected = selectedType === rt.id
                return (
                  <button
                    key={rt.id}
                    className={`report-type-card ${isSelected ? 'selected' : ''} ${locked ? 'locked' : ''}`}
                    onClick={() => !locked && setSelectedType(rt.id)}
                    disabled={locked}
                    style={{ '--type-color': rt.color }}
                  >
                    <div className="report-type-icon">
                      <Icon className="w-5 h-5" style={{ color: rt.color }} />
                      {locked && <Lock className="report-type-lock w-3 h-3" />}
                    </div>
                    <div className="report-type-label">{rt.label}</div>
                    <div className="report-type-desc">{rt.description}</div>
                    {locked && (
                      <span className="report-tier-badge">{rt.minTier}+</span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Options */}
          <div className="report-section">
            <label className="report-label">Title (optional)</label>
            <input
              type="text"
              className="report-input"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Auto-generated from collection name"
            />
          </div>

          <div className="report-section">
            <label className="report-label">Focus Area (optional)</label>
            <textarea
              className="report-textarea"
              value={focusArea}
              onChange={e => setFocusArea(e.target.value)}
              placeholder="Guide the report focus, e.g. 'Compare performance trade-offs' or 'Focus on implementation steps'"
              rows={2}
            />
          </div>

          <div className="report-section">
            <label className="report-toggle-row">
              <input
                type="checkbox"
                checked={webEnrichment}
                onChange={e => setWebEnrichment(e.target.checked)}
              />
              <Globe className="w-4 h-4" />
              <span>Web enrichment</span>
              <span className="report-credit-tag">+3 credits</span>
            </label>
            {webEnrichment && (
              <div className="report-urls">
                <label className="report-sublabel">Manual URLs (optional)</label>
                {manualUrls.map((url, idx) => (
                  <div key={idx} className="report-url-row">
                    <input
                      type="url"
                      className="report-input"
                      value={url}
                      onChange={e => updateUrl(idx, e.target.value)}
                      placeholder="https://..."
                    />
                    {manualUrls.length > 1 && (
                      <button className="report-url-remove" onClick={() => removeUrl(idx)}>
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                ))}
                {manualUrls.length < 5 && (
                  <button className="report-add-url" onClick={addUrl}>
                    <Plus className="w-3 h-3" /> Add URL
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Credit Summary */}
          <div className="report-credit-summary">
            <div className="report-cost-breakdown">
              <div className="report-cost-row">
                <span>Base cost</span><span>{baseCost} credits</span>
              </div>
              {sourceCost > 0 && (
                <div className="report-cost-row">
                  <span>Additional sources ({sourceCount - 1})</span><span>+{sourceCost}</span>
                </div>
              )}
              {webCost > 0 && (
                <div className="report-cost-row">
                  <span>Web enrichment</span><span>+{webCost}</span>
                </div>
              )}
              <div className="report-cost-total">
                <span>Total</span><span>{totalCost} credits</span>
              </div>
            </div>
            <div className="report-balance-row">
              <Coins className="w-4 h-4" />
              <span>Balance: {creditBalance} credits</span>
              {!hasEnoughCredits && <span className="report-insufficient">Not enough credits</span>}
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button
            className="btn-primary"
            onClick={handleSubmit}
            disabled={isSubmitting || !selectedType || !hasEnoughCredits || (!selectedCollectionId && !initialContentIds?.length)}
          >
            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {isSubmitting ? 'Generating...' : `Generate Report (${totalCost} credits)`}
          </button>
        </div>
      </div>
    </div>
  )
}

export default ReportConfigModal
