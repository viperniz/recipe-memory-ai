import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { billingApi } from '../../api/billing'
import { toast } from '../../hooks/use-toast'
import { Button } from '../ui/button'
import { Progress } from '../ui/progress'
import { X, Loader2, CreditCard, ArrowUpRight, Coins, ShoppingCart, ExternalLink } from 'lucide-react'

const TIER_DISPLAY_NAMES = {
  free: 'Free',
  starter: 'Researcher',
  pro: 'Scholar',
  team: 'Department',
}

function BillingModal({ isOpen, onClose }) {
  const { token } = useAuth()
  const navigate = useNavigate()
  const [subscription, setSubscription] = useState(null)
  const [packs, setPacks] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isManaging, setIsManaging] = useState(false)
  const [buyingPack, setBuyingPack] = useState(null)

  useEffect(() => {
    if (!isOpen || !token) return
    setIsLoading(true)
    Promise.all([
      billingApi.getSubscription(token).catch(() => null),
      billingApi.getTopupPacks(token).catch(() => null),
    ]).then(([sub, packsData]) => {
      setSubscription(sub)
      setPacks(packsData)
    }).finally(() => setIsLoading(false))
  }, [isOpen, token])

  if (!isOpen) return null

  const handleManageBilling = async () => {
    setIsManaging(true)
    try {
      const { portal_url } = await billingApi.createPortalSession(token)
      window.location.href = portal_url
    } catch (err) {
      toast({ variant: 'destructive', title: 'Failed to open billing portal', description: err.message })
      setIsManaging(false)
    }
  }

  const handleBuyPack = async (packId) => {
    setBuyingPack(packId)
    try {
      const { checkout_url } = await billingApi.purchaseTopup(token, packId)
      window.location.href = checkout_url
    } catch (err) {
      toast({ variant: 'destructive', title: 'Failed to start checkout', description: err.response?.data?.detail || err.message })
      setBuyingPack(null)
    }
  }

  const tier = subscription?.tier || 'free'
  const tierName = TIER_DISPLAY_NAMES[tier] || 'Free'
  const creditBalance = subscription?.credit_balance ?? 0
  const creditsMonthly = subscription?.credits_monthly ?? 50
  const monthlyBalance = subscription?.monthly_balance ?? creditBalance
  const topupBalance = subscription?.topup_balance ?? 0
  const creditPercentage = creditsMonthly > 0 ? Math.min((monthlyBalance / creditsMonthly) * 100, 100) : 0
  const storageUsedMb = subscription?.storage_used_mb ?? 0
  const storageLimitMb = subscription?.storage_mb ?? 100
  const storagePercent = storageLimitMb > 0 ? Math.min((storageUsedMb / storageLimitMb) * 100, 100) : 0
  const formatStorage = (mb) => mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${mb} MB`

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content billing-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Plans & Billing</h2>
          <button className="modal-close" onClick={onClose}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="modal-body" style={{ padding: '20px 24px' }}>
          {isLoading ? (
            <div className="loading-state" style={{ padding: '2rem', textAlign: 'center' }}>
              <Loader2 className="w-6 h-6 animate-spin" style={{ color: '#a78bfa', margin: '0 auto' }} />
            </div>
          ) : (
            <>
              {/* Current Plan */}
              <div className="billing-section">
                <div className="billing-plan-header">
                  <div>
                    <h3 style={{ margin: 0 }}>{tierName} Plan</h3>
                    <span className="profile-compact-status">
                      <span className="status-dot-indicator" />
                      Active
                    </span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => { onClose(); navigate('/pricing'); }}
                  >
                    <ArrowUpRight className="w-4 h-4 mr-2" />
                    {tier === 'free' ? 'Upgrade' : 'Change Plan'}
                  </Button>
                </div>
              </div>

              {/* Usage Meters */}
              <div className="billing-section">
                <h4 className="billing-section-label">Usage</h4>
                <div className="profile-compact-meter">
                  <div className="profile-compact-meter-label">
                    <span><Coins className="w-3.5 h-3.5 inline-block mr-1" style={{ color: '#71717a' }} />Monthly Allowance</span>
                    <span>{monthlyBalance} / {creditsMonthly}</span>
                  </div>
                  <Progress value={creditPercentage} className="h-2" />
                </div>
                {topupBalance > 0 && (
                  <div className="profile-compact-meter">
                    <div className="profile-compact-meter-label">
                      <span><ShoppingCart className="w-3.5 h-3.5 inline-block mr-1" style={{ color: '#71717a' }} />Top-up Balance</span>
                      <span style={{ color: '#a78bfa', fontWeight: 600 }}>{topupBalance}</span>
                    </div>
                  </div>
                )}
                <div className="profile-compact-meter">
                  <div className="profile-compact-meter-label">
                    <span>Storage</span>
                    <span>{formatStorage(storageUsedMb)} / {formatStorage(storageLimitMb)}</span>
                  </div>
                  <Progress value={storagePercent} className="h-2" />
                </div>
              </div>

              {/* Add Credits */}
              {packs?.topup_allowed && packs.packs?.length > 0 && (
                <div className="billing-section">
                  <h4 className="billing-section-label">Add Credits</h4>
                  <p className="billing-section-desc">Top-ups never expire and are used after your monthly allowance runs out.</p>
                  <div className="buy-credits-grid">
                    {packs.packs.map(pack => (
                      <button
                        key={pack.id}
                        className={`buy-credits-pack ${!pack.available ? 'disabled' : ''}`}
                        onClick={() => pack.available && handleBuyPack(pack.id)}
                        disabled={!pack.available || buyingPack === pack.id}
                      >
                        {buyingPack === pack.id ? (
                          <Loader2 className="w-5 h-5 animate-spin" style={{ color: '#a78bfa' }} />
                        ) : (
                          <>
                            <span className="buy-credits-pack-amount">{pack.credits}</span>
                            <span className="buy-credits-pack-label">credits</span>
                            <span className="buy-credits-pack-price">${pack.price}</span>
                            {!pack.available && (
                              <span className="buy-credits-pack-locked">Pro+ only</span>
                            )}
                          </>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Stripe Portal */}
              {tier !== 'free' && (
                <div className="billing-section">
                  <Button
                    variant="outline"
                    onClick={handleManageBilling}
                    disabled={isManaging}
                    style={{ width: '100%' }}
                  >
                    {isManaging ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Opening Stripe...</>
                    ) : (
                      <><ExternalLink className="w-4 h-4 mr-2" />Manage Billing on Stripe</>
                    )}
                  </Button>
                  <p className="billing-section-desc" style={{ marginTop: 8 }}>
                    View invoices, update payment method, or cancel subscription.
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default BillingModal
