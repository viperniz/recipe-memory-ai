import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import { billingApi } from '../api/billing'
import { authApi } from '../api/auth'
import { toast } from '../hooks/use-toast'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Progress } from '../components/ui/progress'
import { Skeleton } from '../components/ui/skeleton'
import { CreditCard, Loader2, ArrowUpRight, Save, AlertTriangle } from 'lucide-react'
import AppNavbar from '../components/layout/AppNavbar'
import Sidebar from '../components/dashboard/Sidebar'

const TIER_DISPLAY_NAMES = {
  free: 'Free',
  starter: 'Researcher',
  pro: 'Scholar',
  team: 'Department',
}

function ProfilePage() {
  const { user, token, logout, updateProfile } = useAuth()
  const { collections } = useData()
  const navigate = useNavigate()
  const [subscription, setSubscription] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isManaging, setIsManaging] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

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
    document.title = 'Profile — Second Mind'
  }, [])

  useEffect(() => {
    if (user?.full_name) setEditName(user.full_name)
  }, [user])

  useEffect(() => {
    billingApi.getSubscription(token)
      .then(setSubscription)
      .catch((err) => console.error('Failed to load subscription:', err))
      .finally(() => setIsLoading(false))
  }, [token])

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  const handleManageBilling = async () => {
    setIsManaging(true)
    try {
      const { portal_url } = await billingApi.createPortalSession(token)
      window.location.href = portal_url
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Failed to open billing portal',
        description: err.message
      })
      setIsManaging(false)
    }
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

  const hasPassword = user?.has_password !== false

  return (
    <div className="app-layout">
      <AppNavbar user={user} onLogout={handleLogout} sidebarCollapsed={sidebarCollapsed} onToggleSidebar={() => setSidebarCollapsed(!sidebarCollapsed)} />

      <div className="app-body">
        <Sidebar
          activeTab=""
          setActiveTab={() => navigate('/app')}
          collections={collections}
          selectedCollectionId={null}
          setSelectedCollectionId={() => navigate('/app')}
          onNewCollection={() => {}}
          onDeleteCollection={() => {}}
          onCardClick={() => navigate('/app')}
          collapsed={sidebarCollapsed}
        />

        <main id="main-content" className="main-content">
          <div className="profile-compact-wrapper">
            {isLoading ? (
              <div className="profile-container-compact">
                <Skeleton className="h-6 w-48 mb-4" />
                <Skeleton className="h-4 w-full mb-3" />
                <Skeleton className="h-2 w-full mb-4" />
                <Skeleton className="h-4 w-full mb-3" />
                <Skeleton className="h-2 w-full mb-4" />
              </div>
            ) : (
              <>
                {/* Plan & Usage Card */}
                <div className="profile-container-compact">
                  <div className="profile-compact-header">
                    <h1>{tierName} Plan</h1>
                    <span className="profile-compact-status">
                      <span className="status-dot-indicator" />
                      Active
                    </span>
                  </div>

                  <div className="profile-compact-meter">
                    <div className="profile-compact-meter-label">
                      <span>Monthly Allowance</span>
                      <span>{monthlyBalance} / {creditsMonthly}</span>
                    </div>
                    <Progress value={creditPercentage} className="h-2" />
                  </div>

                  <div className="profile-compact-meter">
                    <div className="profile-compact-meter-label">
                      <span>Storage</span>
                      <span>{formatStorage(storageUsedMb)} / {formatStorage(storageLimitMb)}</span>
                    </div>
                    <Progress value={storagePercent} className="h-2" />
                  </div>

                  <div className="profile-compact-actions">
                    <Button variant="outline" onClick={() => navigate('/pricing')} className="flex-1">
                      <ArrowUpRight className="w-4 h-4 mr-2" />
                      Change Plan
                    </Button>
                    <Button variant="outline" onClick={handleManageBilling} disabled={isManaging || tier === 'free'} className="flex-1">
                      {isManaging ? (
                        <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Opening...</>
                      ) : (
                        <><CreditCard className="w-4 h-4 mr-2" />Manage Billing</>
                      )}
                    </Button>
                  </div>
                </div>

                {/* Edit Profile Card */}
                <div className="profile-container-compact">
                  <h2 className="profile-section-title">Edit Profile</h2>
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
                  {user?.created_at && (
                    <p className="profile-meta-text">
                      Account created {new Date(user.created_at).toLocaleDateString()}
                    </p>
                  )}
                </div>

                {/* Change Password Card (only for email/password users) */}
                {hasPassword && (
                  <div className="profile-container-compact">
                    <h2 className="profile-section-title">Change Password</h2>
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
                      <Button type="submit" disabled={isChangingPassword || !currentPassword || !newPassword || !confirmPassword}>
                        {isChangingPassword ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Changing...</> : 'Change Password'}
                      </Button>
                    </form>
                  </div>
                )}

                {/* Danger Zone */}
                <div className="profile-container-compact profile-danger-zone">
                  <h2 className="profile-section-title profile-danger-title">
                    <AlertTriangle className="w-4 h-4" />
                    Danger Zone
                  </h2>
                  <p className="profile-danger-text">
                    Once you delete your account, all your data will be permanently removed. This action cannot be undone.
                  </p>
                  {!showDeleteConfirm ? (
                    <Button variant="destructive" onClick={() => setShowDeleteConfirm(true)}>
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
                        <Button variant="destructive" onClick={handleDeleteAccount} disabled={isDeleting || deleteConfirmText !== 'DELETE'}>
                          {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirm Delete'}
                        </Button>
                        <Button variant="outline" onClick={() => { setShowDeleteConfirm(false); setDeleteConfirmText('') }}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}

export default ProfilePage
