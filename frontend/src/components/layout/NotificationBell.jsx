import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Bell, CheckCircle, Coins, Users, Info } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { notificationsApi } from '../../api/notifications'

const TYPE_ICONS = {
  job_complete: CheckCircle,
  team_invite: Users,
  low_credits: Coins,
  system: Info,
}

function timeAgo(dateStr) {
  if (!dateStr) return ''
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

function NotificationBell() {
  const { token } = useAuth()
  const navigate = useNavigate()
  const [isOpen, setIsOpen] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const dropdownRef = useRef(null)
  const pollRef = useRef(null)

  // Poll unread count
  const fetchUnreadCount = useCallback(async () => {
    if (!token) return
    try {
      const data = await notificationsApi.getUnreadCount(token)
      setUnreadCount(data.count || 0)
    } catch {}
  }, [token])

  // Load full list when dropdown opens
  const fetchNotifications = useCallback(async () => {
    if (!token) return
    try {
      const data = await notificationsApi.list(token, 20)
      setNotifications(data.notifications || [])
    } catch {}
  }, [token])

  // Poll every 60s
  useEffect(() => {
    if (!token) return
    fetchUnreadCount()
    pollRef.current = setInterval(fetchUnreadCount, 60000)
    return () => clearInterval(pollRef.current)
  }, [token, fetchUnreadCount])

  // Load notifications when dropdown opens
  useEffect(() => {
    if (isOpen) fetchNotifications()
  }, [isOpen, fetchNotifications])

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return
    const handleClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false)
      }
    }
    const timer = setTimeout(() => document.addEventListener('mousedown', handleClick, true), 10)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('mousedown', handleClick, true)
    }
  }, [isOpen])

  const handleClickNotification = async (notif) => {
    // Mark as read
    if (!notif.is_read) {
      try {
        await notificationsApi.markRead(token, notif.id)
        setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, is_read: true } : n))
        setUnreadCount(prev => Math.max(0, prev - 1))
      } catch {}
    }
    // Navigate if link
    if (notif.link) {
      navigate(notif.link)
      setIsOpen(false)
    }
  }

  const handleMarkAllRead = async () => {
    try {
      await notificationsApi.markAllRead(token)
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
      setUnreadCount(0)
    } catch {}
  }

  return (
    <div className="notification-bell" ref={dropdownRef}>
      <button className="notification-bell-btn" onClick={() => setIsOpen(!isOpen)} aria-label="Notifications">
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="notification-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
        )}
      </button>

      {isOpen && (
        <div className="notification-dropdown">
          <div className="notification-dropdown-header">
            <h3>Notifications</h3>
            {unreadCount > 0 && (
              <button className="notification-mark-all" onClick={handleMarkAllRead}>
                Mark all read
              </button>
            )}
          </div>
          <div className="notification-list">
            {notifications.length === 0 ? (
              <div className="notification-empty">No notifications yet</div>
            ) : (
              notifications.map(notif => {
                const Icon = TYPE_ICONS[notif.type] || Info
                return (
                  <div
                    key={notif.id}
                    className={`notification-item ${notif.is_read ? '' : 'unread'}`}
                    onClick={() => handleClickNotification(notif)}
                  >
                    <div className="notification-item-icon">
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="notification-item-body">
                      <div className="notification-item-title">{notif.title}</div>
                      {notif.message && <div className="notification-item-message">{notif.message}</div>}
                      <div className="notification-item-time">{timeAgo(notif.created_at)}</div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default NotificationBell
