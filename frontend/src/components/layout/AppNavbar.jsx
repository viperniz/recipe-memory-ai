import React, { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { billingApi } from '../../api/billing'
import { Sparkles, LogOut, ChevronDown, PanelLeftClose, PanelLeftOpen, User as UserIcon } from 'lucide-react'
import NotificationBell from './NotificationBell'

const TIER_DISPLAY_NAMES = {
  free: 'Free',
  starter: 'Researcher',
  pro: 'Scholar',
  team: 'Department',
}

function AppNavbar({ user, onLogout, sidebarCollapsed, onToggleSidebar, onShowProfile }) {
  const navigate = useNavigate()
  const { token } = useAuth()
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
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
      }
    }

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setIsDropdownOpen(false)
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
                onClick={() => { setIsDropdownOpen(false); onShowProfile?.(); }}
              >
                <UserIcon className="w-4 h-4" />
                Profile
              </button>

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
