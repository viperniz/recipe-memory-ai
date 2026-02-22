import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { billingApi } from '../../api/billing'
import { toast } from '../../hooks/use-toast'
import { Progress } from '../ui/progress'
import { X, Loader2, Check, Crown, Sparkles, ExternalLink, ArrowRight } from 'lucide-react'

const PLANS = [
  {
    tier: 'starter',
    name: 'Researcher',
    price: 12.99,
    highlights: [
      '250 credits/mo (25 hrs)',
      'Up to 30 min videos',
      'Flashcards & export',
      '1 GB storage',
    ],
  },
  {
    tier: 'pro',
    name: 'Scholar',
    price: 29.99,
    popular: true,
    highlights: [
      '750 credits/mo (75 hrs)',
      'Up to 2 hr videos',
      'Vision AI, mind maps & guides',
      'Research-grade AI (GPT-4o)',
      '10 GB storage',
    ],
  },
  {
    tier: 'team',
    name: 'Department',
    price: 59.99,
    highlights: [
      '2000 credits/mo (200 hrs)',
      'Unlimited video length',
      'Up to 10 team members',
      'Shared collections & reports',
      '50 GB storage',
    ],
  },
]

function BillingModal({ isOpen, onClose }) {
  const { token } = useAuth()
  const navigate = useNavigate()
  const [subscription, setSubscription] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isManaging, setIsManaging] = useState(false)
  const [processingTier, setProcessingTier] = useState(null)

  useEffect(() => {
    if (!isOpen || !token) return
    setIsLoading(true)
    billingApi.getSubscription(token)
      .then(setSubscription)
      .catch(() => {})
      .finally(() => setIsLoading(false))
  }, [isOpen, token])

  if (!isOpen) return null

  const handleSelectPlan = async (tier) => {
    if (tier === currentTier) return
    setProcessingTier(tier)
    try {
      const { checkout_url } = await billingApi.createCheckout(token, tier)
      window.location.href = checkout_url
    } catch (err) {
      toast({ variant: 'destructive', title: 'Failed to start checkout', description: err.response?.data?.detail || err.message })
      setProcessingTier(null)
    }
  }

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

  const currentTier = subscription?.tier || 'free'
  const tierOrder = ['free', 'starter', 'pro', 'team']
  const isUpgrade = (tier) => tierOrder.indexOf(tier) > tierOrder.indexOf(currentTier)

  const creditBalance = subscription?.credit_balance ?? 0
  const creditsMonthly = subscription?.credits_monthly ?? 50
  const monthlyBalance = subscription?.monthly_balance ?? creditBalance
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

        <div className="modal-body" style={{ padding: '16px 20px' }}>
          {isLoading ? (
            <div className="loading-state" style={{ padding: '2rem', textAlign: 'center' }}>
              <Loader2 className="w-6 h-6 animate-spin" style={{ color: '#a78bfa', margin: '0 auto' }} />
            </div>
          ) : (
            <>
              {/* Usage summary bar */}
              <div className="billing-usage-bar">
                <div className="billing-usage-item">
                  <span>Credits</span>
                  <span>{monthlyBalance}/{creditsMonthly}</span>
                  <Progress value={creditPercentage} className="h-1.5" />
                </div>
                <div className="billing-usage-item">
                  <span>Storage</span>
                  <span>{formatStorage(storageUsedMb)}/{formatStorage(storageLimitMb)}</span>
                  <Progress value={storagePercent} className="h-1.5" />
                </div>
              </div>

              {/* Plan cards */}
              <div className="billing-plans-grid">
                {PLANS.map(plan => {
                  const isCurrent = plan.tier === currentTier
                  const canUpgrade = isUpgrade(plan.tier)

                  return (
                    <button
                      key={plan.tier}
                      className={`billing-plan-card ${isCurrent ? 'current' : ''} ${plan.popular ? 'popular' : ''}`}
                      onClick={() => !isCurrent && handleSelectPlan(plan.tier)}
                      disabled={isCurrent || processingTier === plan.tier}
                    >
                      {plan.popular && <span className="billing-plan-badge"><Sparkles className="w-3 h-3" />Best value</span>}
                      {isCurrent && <span className="billing-plan-badge current-badge"><Crown className="w-3 h-3" />Current</span>}

                      <div className="billing-plan-name">{plan.name}</div>
                      <div className="billing-plan-price">
                        <span className="billing-plan-currency">$</span>
                        <span className="billing-plan-amount">{plan.price}</span>
                        <span className="billing-plan-period">/mo</span>
                      </div>

                      <ul className="billing-plan-highlights">
                        {plan.highlights.map((h, i) => (
                          <li key={i}><Check className="w-3.5 h-3.5" />{h}</li>
                        ))}
                      </ul>

                      <div className="billing-plan-action">
                        {processingTier === plan.tier ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : isCurrent ? (
                          <span>Active</span>
                        ) : canUpgrade ? (
                          <span>Upgrade <ArrowRight className="w-3.5 h-3.5" /></span>
                        ) : (
                          <span>Switch</span>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>

              {/* Footer links */}
              <div className="billing-footer">
                <button
                  className="billing-footer-link"
                  onClick={() => { onClose(); navigate('/pricing'); }}
                >
                  See all features & compare plans <ArrowRight className="w-3.5 h-3.5" />
                </button>

                {currentTier !== 'free' && (
                  <button
                    className="billing-footer-link"
                    onClick={handleManageBilling}
                    disabled={isManaging}
                  >
                    {isManaging ? (
                      <><Loader2 className="w-3.5 h-3.5 animate-spin" />Opening Stripe...</>
                    ) : (
                      <><ExternalLink className="w-3.5 h-3.5" />Manage billing on Stripe</>
                    )}
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default BillingModal
