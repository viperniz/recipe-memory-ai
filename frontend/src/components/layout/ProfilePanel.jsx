import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useTheme } from '../../context/ThemeContext'
import { authApi } from '../../api/auth'
import { toast } from '../../hooks/use-toast'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { X, Loader2, Save, AlertTriangle, Copy, Check, Gift, Camera, Sun, Moon } from 'lucide-react'
import { referralsApi } from '../../api/referrals'
import { API_BASE } from '../../lib/apiBase'

const CONTENT_MODES = [
  { id: 'general', label: 'General' },
  { id: 'learn', label: 'Tutorial' },
  { id: 'meeting', label: 'Lecture' },
  { id: 'creator', label: 'Podcast' },
  { id: 'deepdive', label: 'Deep Dive' },
]

const LANGUAGES = [
  { id: 'auto', label: 'Auto-detect' },
  { id: 'en', label: 'English' },
  { id: 'es', label: 'Spanish' },
  { id: 'fr', label: 'French' },
  { id: 'de', label: 'German' },
  { id: 'pt', label: 'Portuguese' },
  { id: 'it', label: 'Italian' },
  { id: 'nl', label: 'Dutch' },
  { id: 'ja', label: 'Japanese' },
  { id: 'ko', label: 'Korean' },
  { id: 'zh', label: 'Chinese' },
  { id: 'ar', label: 'Arabic' },
  { id: 'hi', label: 'Hindi' },
  { id: 'ru', label: 'Russian' },
  { id: 'tr', label: 'Turkish' },
  { id: 'pl', label: 'Polish' },
  { id: 'sv', label: 'Swedish' },
  { id: 'da', label: 'Danish' },
  { id: 'no', label: 'Norwegian' },
  { id: 'fi', label: 'Finnish' },
]

function ProfilePanel({ isOpen, onClose }) {
  const { user, token, logout, updateProfile, updateAvatar } = useAuth()
  const { theme, setTheme } = useTheme()
  const navigate = useNavigate()
  const avatarInputRef = useRef(null)

  // Edit profile state
  const [editName, setEditName] = useState('')
  const [isSavingName, setIsSavingName] = useState(false)

  // Avatar state
  const [avatarUploading, setAvatarUploading] = useState(false)

  // Preferences state
  const [preferences, setPreferences] = useState({
    default_mode: 'general',
    default_language: 'auto',
    theme: 'dark',
    email_job_complete: true,
    email_low_credits: true,
    email_referral: true,
  })

  // Change password state
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isChangingPassword, setIsChangingPassword] = useState(false)

  // Delete account state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)

  // Referral state
  const [referralStats, setReferralStats] = useState(null)
  const [copiedLink, setCopiedLink] = useState(false)

  useEffect(() => {
    if (!isOpen) {
      setShowDeleteConfirm(false)
      setDeleteConfirmText('')
    }
  }, [isOpen])

  useEffect(() => {
    if (user?.full_name) setEditName(user.full_name)
  }, [user])

  useEffect(() => {
    if (isOpen && token) {
      referralsApi.getStats(token).then(setReferralStats).catch(() => {})
      authApi.getPreferences(token).then(setPreferences).catch(() => {})
    }
  }, [isOpen, token])

  if (!isOpen) return null

  const getAvatarUrl = () => {
    if (!user?.avatar_url) return null
    // If it's a relative API path, prepend API_BASE
    if (user.avatar_url.startsWith('/api/')) {
      return API_BASE.replace('/api', '') + user.avatar_url
    }
    return user.avatar_url
  }

  const getUserInitial = () => {
    if (user?.full_name) return user.full_name.charAt(0).toUpperCase()
    if (user?.email) return user.email.charAt(0).toUpperCase()
    return 'U'
  }

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const allowed = ['image/jpeg', 'image/png', 'image/webp']
    if (!allowed.includes(file.type)) {
      toast({ variant: 'destructive', title: 'Only jpg, png, webp images are allowed' })
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      toast({ variant: 'destructive', title: 'File too large (max 2MB)' })
      return
    }
    setAvatarUploading(true)
    try {
      await updateAvatar(file)
      toast({ variant: 'success', title: 'Avatar updated' })
    } catch (err) {
      toast({ variant: 'destructive', title: 'Failed to upload avatar', description: err.message })
    } finally {
      setAvatarUploading(false)
      if (avatarInputRef.current) avatarInputRef.current.value = ''
    }
  }

  const handlePrefChange = async (key, value) => {
    const updated = { ...preferences, [key]: value }
    setPreferences(updated)
    try {
      await authApi.updatePreferences(token, { [key]: value })
    } catch (err) {
      toast({ variant: 'destructive', title: 'Failed to save preference' })
    }
  }

  const handleThemeChange = (t) => {
    setTheme(t)
    handlePrefChange('theme', t)
  }

  const handleSaveName = async () => {
    if (!editName.trim()) return
    setIsSavingName(true)
    try {
      await updateProfile({ full_name: editName.trim() })
      toast({ variant: 'success', title: 'Profile updated' })
    } catch (err) {
      toast({ variant: 'destructive', title: 'Failed to update profile', description: err.message })
    } finally {
      setIsSavingName(false)
    }
  }

  const handleChangePassword = async (e) => {
    e.preventDefault()
    if (newPassword !== confirmPassword) {
      toast({ variant: 'destructive', title: 'Passwords do not match' })
      return
    }
    if (newPassword.length < 8) {
      toast({ variant: 'destructive', title: 'Password must be at least 8 characters' })
      return
    }
    setIsChangingPassword(true)
    try {
      await authApi.changePassword(token, currentPassword, newPassword)
      toast({ variant: 'success', title: 'Password changed successfully' })
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err) {
      const detail = err.response?.data?.detail || err.message
      toast({ variant: 'destructive', title: 'Failed to change password', description: detail })
    } finally {
      setIsChangingPassword(false)
    }
  }

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== 'DELETE') return
    setIsDeleting(true)
    try {
      await authApi.deleteAccount(token)
      toast({ variant: 'success', title: 'Account deleted' })
      logout()
      navigate('/')
    } catch (err) {
      toast({ variant: 'destructive', title: 'Failed to delete account', description: err.message })
      setIsDeleting(false)
    }
  }

  const handleCopyReferralLink = () => {
    if (!referralStats?.referral_link) return
    navigator.clipboard.writeText(referralStats.referral_link)
    setCopiedLink(true)
    toast({ variant: 'success', title: 'Referral link copied!' })
    setTimeout(() => setCopiedLink(false), 2000)
  }

  const hasPassword = user?.has_password !== false
  const avatarUrl = getAvatarUrl()

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content profile-panel"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2>Profile</h2>
          <button className="modal-close" onClick={onClose}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="modal-body" style={{ padding: '20px 24px' }}>
          {/* Avatar Header */}
          <div className="profile-avatar-header">
            <div className="profile-avatar-wrapper" onClick={() => avatarInputRef.current?.click()}>
              {avatarUploading ? (
                <div className="profile-avatar-img profile-avatar-loading">
                  <Loader2 className="w-6 h-6 animate-spin" />
                </div>
              ) : avatarUrl ? (
                <img src={avatarUrl} alt="Avatar" className="profile-avatar-img" />
              ) : (
                <div className="profile-avatar-img profile-avatar-initial">
                  {getUserInitial()}
                </div>
              )}
              <div className="profile-avatar-overlay">
                <Camera className="w-4 h-4" />
              </div>
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleAvatarUpload}
                style={{ display: 'none' }}
              />
            </div>
            <div className="profile-avatar-info">
              <div className="profile-avatar-name">{user?.full_name || 'No name set'}</div>
              <div className="profile-avatar-email">{user?.email}</div>
            </div>
          </div>

          {/* Edit Profile */}
          <div className="profile-panel-section">
            <h3 className="profile-section-title">Edit Profile</h3>
            <div className="profile-form-group">
              <label className="profile-form-label">Full Name</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Your name"
                />
                <Button onClick={handleSaveName} disabled={isSavingName || editName === user?.full_name}>
                  {isSavingName ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                </Button>
              </div>
            </div>
          </div>

          {/* Preferences */}
          <div className="profile-panel-section">
            <h3 className="profile-section-title">Preferences</h3>

            <div className="profile-form-group">
              <label className="profile-form-label">Default Mode</label>
              <select
                className="profile-select"
                value={preferences.default_mode}
                onChange={(e) => handlePrefChange('default_mode', e.target.value)}
              >
                {CONTENT_MODES.map(m => (
                  <option key={m.id} value={m.id}>{m.label}</option>
                ))}
              </select>
            </div>

            <div className="profile-form-group">
              <label className="profile-form-label">Default Language</label>
              <select
                className="profile-select"
                value={preferences.default_language}
                onChange={(e) => handlePrefChange('default_language', e.target.value)}
              >
                {LANGUAGES.map(l => (
                  <option key={l.id} value={l.id}>{l.label}</option>
                ))}
              </select>
            </div>

            <div className="profile-form-group">
              <label className="profile-form-label">Theme</label>
              <div className="profile-theme-toggle">
                <button
                  className={`profile-theme-btn ${theme === 'dark' ? 'active' : ''}`}
                  onClick={() => handleThemeChange('dark')}
                >
                  <Moon className="w-4 h-4" />
                  Dark
                </button>
                <button
                  className={`profile-theme-btn ${theme === 'light' ? 'active' : ''}`}
                  onClick={() => handleThemeChange('light')}
                >
                  <Sun className="w-4 h-4" />
                  Light
                </button>
              </div>
            </div>

            <div className="profile-form-group">
              <label className="profile-form-label">Email Notifications</label>
              <div className="profile-toggles">
                <label className="profile-toggle-row">
                  <span>Source ready</span>
                  <input
                    type="checkbox"
                    className="profile-toggle-switch"
                    checked={preferences.email_job_complete}
                    onChange={(e) => handlePrefChange('email_job_complete', e.target.checked)}
                  />
                </label>
                <label className="profile-toggle-row">
                  <span>Low credits warning</span>
                  <input
                    type="checkbox"
                    className="profile-toggle-switch"
                    checked={preferences.email_low_credits}
                    onChange={(e) => handlePrefChange('email_low_credits', e.target.checked)}
                  />
                </label>
                <label className="profile-toggle-row">
                  <span>Referral activity</span>
                  <input
                    type="checkbox"
                    className="profile-toggle-switch"
                    checked={preferences.email_referral}
                    onChange={(e) => handlePrefChange('email_referral', e.target.checked)}
                  />
                </label>
              </div>
            </div>
          </div>

          {/* Change Password */}
          {hasPassword && (
            <div className="profile-panel-section">
              <h3 className="profile-section-title">Change Password</h3>
              <form onSubmit={handleChangePassword}>
                <div className="profile-form-group">
                  <label className="profile-form-label">Current Password</label>
                  <Input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required />
                </div>
                <div className="profile-form-group">
                  <label className="profile-form-label">New Password</label>
                  <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={8} />
                </div>
                <div className="profile-form-group">
                  <label className="profile-form-label">Confirm New Password</label>
                  <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required minLength={8} />
                </div>
                <Button type="submit" size="sm" disabled={isChangingPassword || !currentPassword || !newPassword || !confirmPassword}>
                  {isChangingPassword ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Changing...</> : 'Change Password'}
                </Button>
              </form>
            </div>
          )}

          {/* Referral Program */}
          {referralStats && (
            <div className="profile-panel-section">
              <h3 className="profile-section-title">
                <Gift className="w-4 h-4" style={{ marginRight: 6 }} />
                Refer & Earn
              </h3>
              <p className="profile-referral-desc">
                Share your link and earn <strong>50 credits</strong> for each friend who signs up. They get <strong>25 bonus credits</strong> too.
              </p>
              <div className="profile-referral-link-row">
                <Input
                  value={referralStats.referral_link}
                  readOnly
                  className="profile-referral-input"
                />
                <Button size="sm" variant="outline" onClick={handleCopyReferralLink}>
                  {copiedLink ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
              <div className="profile-referral-stats">
                <div className="profile-referral-stat">
                  <span className="profile-referral-stat-value">{referralStats.total_referrals}</span>
                  <span className="profile-referral-stat-label">Referrals</span>
                </div>
                <div className="profile-referral-stat">
                  <span className="profile-referral-stat-value">{referralStats.total_credits_earned}</span>
                  <span className="profile-referral-stat-label">Credits earned</span>
                </div>
              </div>
            </div>
          )}

          {/* Danger Zone */}
          <div className="profile-panel-section profile-danger-zone">
            <h3 className="profile-section-title profile-danger-title">
              <AlertTriangle className="w-4 h-4" />
              Danger Zone
            </h3>
            <p className="profile-danger-text">
              Once you delete your account, all your data will be permanently removed.
            </p>
            {!showDeleteConfirm ? (
              <Button variant="destructive" size="sm" onClick={() => setShowDeleteConfirm(true)}>
                Delete Account
              </Button>
            ) : (
              <div className="profile-delete-confirm">
                <p className="profile-danger-text">Type <strong>DELETE</strong> to confirm:</p>
                <div style={{ display: 'flex', gap: 8 }}>
                  <Input
                    value={deleteConfirmText}
                    onChange={(e) => setDeleteConfirmText(e.target.value)}
                    placeholder="Type DELETE"
                  />
                  <Button variant="destructive" size="sm" onClick={handleDeleteAccount} disabled={isDeleting || deleteConfirmText !== 'DELETE'}>
                    {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirm'}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => { setShowDeleteConfirm(false); setDeleteConfirmText('') }}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default ProfilePanel
