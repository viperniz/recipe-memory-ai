import React, { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { billingApi } from '../../api/billing'
import { Progress } from '../ui/progress'
import { Sparkles, LogOut, CreditCard, ChevronDown, ChevronUp, PanelLeftClose, PanelLeftOpen, BarChart3, ArrowUpRight, User as UserIcon } from 'lucide-react'
import NotificationBell from './NotificationBell'

const TIER_DISPLAY_NAMES = {
  free: 'Free',
  starter: 'Researcher',
  pro: 'Scholar',
  team: 'Department',
}

function AppNavbar({ user, onLogout, sidebarCollapsed, onToggleSidebar }) {
  const navigate = useNavigate()
  const { token } = useAuth()
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [usageExpanded, setUsageExpanded] = useState(false)
  const [subscription, setSubscription] = useState(null)
  const dropdownRef = useRef(null)

  useEffect(() => {
    if (!token) return
    billingApi.getSubscription(token).then(setSubscription).catch(() => {})
  }, [token])

  const getUserInitial = () => {
    if (user?.full_name) return user.full_name.charAt(0).toUpperCase()
    if (user?.email) return user.email.charAt(0).toUpperCase()
    return 'U'
  }

  useEffect(() => {
    if (!isDropdownOpen) return

    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false)
        setUsageExpanded(false)
      }
    }

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setIsDropdownOpen(false)
        setUsageExpanded(false)
      }
    }

    const timeoutId = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside, true)
    }, 10)
    document.addEventListener('keydown', handleEscape)

    return () => {
      clearTimeout(timeoutId)
      document.removeEventListener('mousedown', handleClickOutside, true)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isDropdownOpen])

  const tier = subscription?.tier || 'free'
  const tierName = TIER_DISPLAY_NAMES[tier] || 'Free'
  const creditBalance = subscription?.credit_balance ?? 0
  const creditsMonthly = subscription?.credits_monthly ?? 50
  const monthlyBalance = subscription?.monthly_balance ?? creditBalance
  const creditPercentage = creditsMonthly > 0 ? Math.min((monthlyBalance / creditsMonthly) * 100, 100) : 0
  const storageUsedMb = subscription?.storage_used_mb ?? 0
  const storageLimitMb = subscription?.storage_mb ?? 100
  const storagePercent = storageLimitMb > 0 ? Math.min((storageUsedMb / storageLimitMb) * 100, 100) : 0

  const formatStorage = (mb) => mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${mb} MB`

  const showUpgrade = tier === 'free' || tier === 'starter'

  return (
    <header>
    <nav className="app-topnav">
      <div className="app-topnav-left">
        <button
          className="app-topnav-toggle"
          onClick={onToggleSidebar}
          title={sidebarCollapsed ? 'Show sidebar' : 'Hide sidebar'}
        >
          {sidebarCollapsed ? <PanelLeftOpen className="w-5 h-5" /> : <PanelLeftClose className="w-5 h-5" />}
        </button>
        <div className="app-topnav-logo">
          <div className="app-topnav-logo-icon">
            <Sparkles className="w-4 h-4" />
          </div>
          <span>Second Mind</span>
        </div>
      </div>

      <div className="app-topnav-right">
        {/* Credit/plan pill */}
        {subscription && (
          <div className="app-topnav-plan-pill">
            <span className="app-topnav-plan-credits">{creditBalance} credits</span>
            <span className="app-topnav-plan-dot">&middot;</span>
            <span className="app-topnav-plan-tier">{tierName}</span>
            {showUpgrade && (
              <button
                className="app-topnav-upgrade-btn"
                onClick={() => navigate('/pricing')}
              >
                Upgrade
              </button>
            )}
          </div>
        )}

        {/* Notification Bell */}
        <NotificationBell />

        {/* User dropdown */}
        <div className="app-topnav-user" ref={dropdownRef}>
          <button
            className="app-topnav-user-btn"
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          >
            <div className="app-topnav-avatar">
              {getUserInitial()}
            </div>
            <span className="app-topnav-user-name">
              {user?.full_name || user?.email?.split('@')[0] || 'User'}
            </span>
            <ChevronDown className={`w-4 h-4 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
          </button>

          {isDropdownOpen && (
            <div className="app-topnav-dropdown">
              <div className="app-topnav-dropdown-header">
                <div className="app-topnav-avatar">{getUserInitial()}</div>
                <div>
                  {user?.full_name && <div className="app-topnav-dropdown-name">{user.full_name}</div>}
                  <div className="app-topnav-dropdown-email">{user?.email}</div>
                  {subscription && (
                    <div className="app-topnav-dropdown-tier">{tierName} Plan</div>
                  )}
                </div>
              </div>
              <div className="app-topnav-dropdown-divider" />

              <button
                className="app-topnav-dropdown-item"
                onClick={() => { setIsDropdownOpen(false); navigate('/profile'); }}
              >
                <UserIcon className="w-4 h-4" />
                Profile
              </button>
              <button
                className="app-topnav-dropdown-item"
                onClick={() => { setIsDropdownOpen(false); navigate('/pricing'); }}
              >
                <CreditCard className="w-4 h-4" />
                Plans & Billing
              </button>

              {/* Usage toggle */}
              <button
                className="app-topnav-dropdown-item"
                onClick={() => setUsageExpanded(!usageExpanded)}
              >
                <BarChart3 className="w-4 h-4" />
                Usage
                {usageExpanded
                  ? <ChevronUp className="w-3.5 h-3.5" style={{ marginLeft: 'auto' }} />
                  : <ChevronDown className="w-3.5 h-3.5" style={{ marginLeft: 'auto' }} />
                }
              </button>

              {usageExpanded && subscription && (
                <div className="app-topnav-dropdown-usage">
                  <div className="app-topnav-usage-row">
                    <span>Allowance</span>
                    <span>{monthlyBalance} / {creditsMonthly}</span>
                  </div>
                  <Progress value={creditPercentage} className="h-1.5" />
                  <div className="app-topnav-usage-row" style={{ marginTop: 10 }}>
                    <span>Storage</span>
                    <span>{formatStorage(storageUsedMb)} / {formatStorage(storageLimitMb)}</span>
                  </div>
                  <Progress value={storagePercent} className="h-1.5" />
                </div>
              )}

              <div className="app-topnav-dropdown-divider" />
              <button
                className="app-topnav-dropdown-item app-topnav-dropdown-danger"
                onClick={() => { setIsDropdownOpen(false); onLogout(); }}
              >
                <LogOut className="w-4 h-4" />
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </nav>
    </header>
  )
}

export default AppNavbar
