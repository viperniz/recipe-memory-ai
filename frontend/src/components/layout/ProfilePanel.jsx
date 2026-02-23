import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { authApi } from '../../api/auth'
import { toast } from '../../hooks/use-toast'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { X, Loader2, Save, AlertTriangle, Copy, Check, Users, Gift } from 'lucide-react'
import { referralsApi } from '../../api/referrals'

function ProfilePanel({ isOpen, onClose }) {
  const { user, token, logout, updateProfile } = useAuth()
  const navigate = useNavigate()

  // Edit profile state
  const [editName, setEditName] = useState('')
  const [isSavingName, setIsSavingName] = useState(false)

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
    // reset form state when panel closes
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
    }
  }, [isOpen, token])

  if (!isOpen) return null

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
            <>
              {/* Edit Profile */}
              <div className="profile-panel-section">
                <h3 className="profile-section-title">Edit Profile</h3>
                <div className="profile-form-group">
                  <label className="profile-form-label">Email</label>
                  <Input value={user?.email || ''} disabled />
                </div>
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
            </>
        </div>
      </div>
    </div>
  )
}

export default ProfilePanel
