import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { authApi } from '../../api/auth'
import { toast } from '../../hooks/use-toast'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { X, Loader2, Save, AlertTriangle } from 'lucide-react'

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
