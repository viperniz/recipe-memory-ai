import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import { billingApi } from '../api/billing'
import { toast } from '../hooks/use-toast'
import { Button } from '../components/ui/button'
import { Progress } from '../components/ui/progress'
import { Skeleton } from '../components/ui/skeleton'
import { CreditCard, Loader2, ArrowUpRight } from 'lucide-react'
import AppNavbar from '../components/layout/AppNavbar'
import Sidebar from '../components/dashboard/Sidebar'

const TIER_DISPLAY_NAMES = {
  free: 'Free',
  starter: 'Researcher',
  pro: 'Scholar',
  team: 'Department',
}

function ProfilePage() {
  const { user, token, logout } = useAuth()
  const { collections } = useData()
  const navigate = useNavigate()
  const [subscription, setSubscription] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isManaging, setIsManaging] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  useEffect(() => {
    document.title = 'Profile — Second Mind'
  }, [])

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
                <div style={{ display: 'flex', gap: 12 }}>
                  <Skeleton className="h-9 w-full" />
                  <Skeleton className="h-9 w-full" />
                </div>
              </div>
            ) : (
              <div className="profile-container-compact">
                {/* Header: plan name + status */}
                <div className="profile-compact-header">
                  <h1>{tierName} Plan</h1>
                  <span className="profile-compact-status">
                    <span className="status-dot-indicator" />
                    Active
                  </span>
                </div>

                {/* Monthly allowance meter */}
                <div className="profile-compact-meter">
                  <div className="profile-compact-meter-label">
                    <span>Monthly Allowance</span>
                    <span>{monthlyBalance} / {creditsMonthly}</span>
                  </div>
                  <Progress value={creditPercentage} className="h-2" />
                </div>

                {/* Storage meter */}
                <div className="profile-compact-meter">
                  <div className="profile-compact-meter-label">
                    <span>Storage</span>
                    <span>{formatStorage(storageUsedMb)} / {formatStorage(storageLimitMb)}</span>
                  </div>
                  <Progress value={storagePercent} className="h-2" />
                </div>

                {/* Actions */}
                <div className="profile-compact-actions">
                  <Button
                    variant="outline"
                    onClick={() => navigate('/pricing')}
                    className="flex-1"
                  >
                    <ArrowUpRight className="w-4 h-4 mr-2" />
                    Change Plan
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleManageBilling}
                    disabled={isManaging || tier === 'free'}
                    className="flex-1"
                  >
                    {isManaging ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Opening...
                      </>
                    ) : (
                      <>
                        <CreditCard className="w-4 h-4 mr-2" />
                        Manage Billing
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}

export default ProfilePage
