import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, Library, FolderOpen, X, Menu, Clock, Sparkles, Users, ArrowUpRight } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useData } from '../../context/DataContext'
import { billingApi } from '../../api/billing'
import { Progress } from '../ui/progress'
import BuyCreditsModal from '../modals/BuyCreditsModal'

const TIER_DISPLAY_NAMES = {
  free: 'Free',
  starter: 'Researcher',
  pro: 'Scholar',
  team: 'Department',
}

function Sidebar({
  activeTab,
  setActiveTab,
  collections,
  selectedCollectionId,
  setSelectedCollectionId,
  onNewCollection,
  onDeleteCollection,
  onCardClick,
  collapsed
}) {
  const navigate = useNavigate()
  const { token } = useAuth()
  const { libraryContents } = useData()
  const [isMobileOpen, setIsMobileOpen] = useState(false)
  const [subscription, setSubscription] = useState(null)
  const [showBuyCredits, setShowBuyCredits] = useState(false)

  useEffect(() => {
    if (!token) return
    billingApi.getSubscription(token).then(setSubscription).catch(() => {})
  }, [token])

  const handleTabChange = (tab) => {
    setActiveTab(tab)
    setIsMobileOpen(false)
  }

  const handleCollectionSelect = (collId) => {
    setSelectedCollectionId(collId)
    setActiveTab('collection')
    setIsMobileOpen(false)
  }

  const handleRecentClick = (contentId) => {
    if (onCardClick) {
      onCardClick(contentId)
    }
    setIsMobileOpen(false)
  }

  // Recent sources: last 3 by most recent
  const recentItems = (libraryContents || [])
    .slice(0, 3)

  const tier = subscription?.tier || 'free'
  const creditBalance = subscription?.credit_balance ?? 0
  const creditsMonthly = subscription?.credits_monthly ?? 50
  const monthlyBalance = subscription?.monthly_balance ?? creditBalance
  const creditPercentage = creditsMonthly > 0 ? Math.min((monthlyBalance / creditsMonthly) * 100, 100) : 0

  return (
    <>
      {/* Mobile hamburger button */}
      <button
        className="sidebar-mobile-toggle"
        onClick={() => setIsMobileOpen(!isMobileOpen)}
        aria-label="Toggle sidebar"
      >
        {isMobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
      </button>

      {isMobileOpen && (
        <div className="sidebar-backdrop" onClick={() => setIsMobileOpen(false)} />
      )}

      <aside className={`sidebar ${isMobileOpen ? 'sidebar-mobile-open' : ''} ${collapsed ? 'sidebar-collapsed' : ''}`}>
        <div className="sidebar-logo" title="Your second mind for research, learning & deep work">Second Mind</div>

        {/* Zone 1: Navigation */}
        <div className="sidebar-section">
          <button
            className={`nav-btn ${activeTab === 'new' ? 'active' : ''}`}
            onClick={() => handleTabChange('new')}
          >
            <Plus className="inline-block w-4 h-4 mr-2" />
            Add Source
          </button>
          <button
            className={`nav-btn ${activeTab === 'search' ? 'active' : ''}`}
            onClick={() => handleTabChange('search')}
          >
            <Search className="inline-block w-4 h-4 mr-2" />
            Discover
          </button>
          <button
            className={`nav-btn ${activeTab === 'library' ? 'active' : ''}`}
            onClick={() => handleTabChange('library')}
          >
            <Library className="inline-block w-4 h-4 mr-2" />
            Knowledge Base
          </button>
        </div>

        {/* Zone 2: Research Collections */}
        <div className="sidebar-section">
          <div className="sidebar-section-title">Research Collections</div>
          <button
            className="nav-btn-small"
            onClick={() => { onNewCollection(); setIsMobileOpen(false); }}
          >
            <Plus className="inline-block w-3 h-3 mr-1" />
            New Collection
          </button>
          {collections.map(coll => (
            <div key={coll.id} className="collection-nav-item">
              <button
                className={`nav-btn ${activeTab === 'collection' && selectedCollectionId === coll.id ? 'active' : ''}`}
                onClick={() => handleCollectionSelect(coll.id)}
              >
                <FolderOpen className="inline-block w-4 h-4 mr-2" />
                {coll.name}
              </button>
              <button
                className="collection-delete-btn"
                onClick={(e) => {
                  e.stopPropagation()
                  onDeleteCollection(coll.id)
                }}
                title="Delete collection"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
          {collections.length === 0 && (
            <div className="queue-empty">No collections yet</div>
          )}
        </div>

        {/* Zone 3: Recent sources */}
        {recentItems.length > 0 && (
          <div className="sidebar-section">
            <div className="sidebar-section-title">Recent</div>
            {recentItems.map(item => (
              <button
                key={item.id}
                className="sidebar-recent-item"
                onClick={() => handleRecentClick(item.id)}
                title={item.title}
              >
                <Clock className="w-3.5 h-3.5 sidebar-recent-icon" />
                <span className="sidebar-recent-title">{item.title || 'Untitled'}</span>
              </button>
            ))}
          </div>
        )}

        {/* Zone 4: Bottom CTA card (pinned) */}
        <div className="sidebar-bottom-section">
          {(tier === 'free' || tier === 'starter') && (
            <div className="sidebar-cta-card sidebar-cta-upgrade">
              <Sparkles className="w-4 h-4 sidebar-cta-icon" />
              <div className="sidebar-cta-text">
                <strong>Unlock your full second mind</strong>
                <span>Mind maps, study guides & research-grade AI</span>
              </div>
              <button
                className="sidebar-cta-btn"
                onClick={() => { navigate('/pricing'); setIsMobileOpen(false); }}
              >
                Upgrade to {TIER_DISPLAY_NAMES.pro}
              </button>
            </div>
          )}

          {tier === 'pro' && subscription && (
            <div className="sidebar-cta-card sidebar-cta-usage">
              <div className="sidebar-cta-usage-header">
                <span>{monthlyBalance} / {creditsMonthly} used</span>
              </div>
              <Progress value={creditPercentage} className="h-1.5" />
              <button
                className="sidebar-cta-link"
                onClick={() => setShowBuyCredits(true)}
              >
                Need more? Add usage <ArrowUpRight className="w-3 h-3" />
              </button>
            </div>
          )}

          {tier === 'team' && (
            <div className="sidebar-cta-card sidebar-cta-team">
              <Users className="w-4 h-4 sidebar-cta-icon" />
              <div className="sidebar-cta-text">
                <strong>Invite your team</strong>
                <span>Collaborate on shared research</span>
              </div>
              <button
                className="sidebar-cta-btn"
                onClick={() => { navigate('/profile'); setIsMobileOpen(false); }}
              >
                Manage members
              </button>
            </div>
          )}
        </div>
      </aside>

      <BuyCreditsModal
        isOpen={showBuyCredits}
        onClose={() => setShowBuyCredits(false)}
      />
    </>
  )
}

export default Sidebar
