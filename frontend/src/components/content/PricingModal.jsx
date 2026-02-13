import React, { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { billingApi } from '../../api/billing'
import { toast } from '../../hooks/use-toast'
import { Button } from '../ui/button'
import { Badge } from '../ui/badge'
import { Skeleton } from '../ui/skeleton'
import {
  X,
  Check,
  Loader2,
  Sparkles,
  Video,
  HardDrive,
  Eye,
  Zap,
  Crown,
  Clock
} from 'lucide-react'

function PricingModal({ onClose, reason }) {
  const { user, token, isAuthenticated } = useAuth()
  const [plans, setPlans] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [billingPeriod, setBillingPeriod] = useState('monthly')
  const [processingTier, setProcessingTier] = useState(null)
  const currentTier = user?.tier || 'free'

  useEffect(() => {
    const loadPlans = async () => {
      try {
        const plansData = await billingApi.getPlans()
        setPlans(plansData)
      } catch (err) {
        console.error('Failed to load plans:', err)
        toast({
          variant: 'destructive',
          title: 'Failed to load plans',
          description: err.message
        })
      } finally {
        setIsLoading(false)
      }
    }
    loadPlans()
  }, [])

  const handleSelectPlan = async (tier) => {
    if (tier === 'free' || tier === currentTier) {
      onClose()
      return
    }

    setProcessingTier(tier)
    try {
      const { checkout_url } = await billingApi.createCheckout(token, tier, billingPeriod)
      window.location.href = checkout_url
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Failed to start checkout',
        description: err.response?.data?.detail || err.message
      })
      setProcessingTier(null)
    }
  }

  return (
    <div className="pricing-modal-overlay" onClick={onClose}>
      <div className="pricing-modal" onClick={(e) => e.stopPropagation()}>
        <button className="pricing-modal-close" onClick={onClose}>
          <X className="w-5 h-5" />
        </button>

        <div className="pricing-modal-header">
          <Crown className="w-6 h-6 text-purple-400" />
          <h2>Upgrade to Unlock</h2>
          <p>Upgrade your plan to unlock this feature.</p>
          <div className="billing-toggle">
            <button
              className={`toggle-btn ${billingPeriod === 'monthly' ? 'active' : ''}`}
              onClick={() => setBillingPeriod('monthly')}
            >
              Monthly
            </button>
            <button
              className={`toggle-btn ${billingPeriod === 'yearly' ? 'active' : ''}`}
              onClick={() => setBillingPeriod('yearly')}
            >
              Yearly
              <Badge variant="success" className="ml-2">Save 20%</Badge>
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="pricing-modal-plans">
            {[1, 2, 3].map(i => (
              <div key={i} className="plan-card">
                <Skeleton className="h-6 w-20 mb-3" />
                <Skeleton className="h-10 w-24 mb-4" />
                <div className="space-y-2">
                  {[1, 2, 3].map(j => (
                    <Skeleton key={j} className="h-4 w-full" />
                  ))}
                </div>
                <Skeleton className="h-10 w-full mt-4" />
              </div>
            ))}
          </div>
        ) : (
          <div className="pricing-modal-plans">
            {plans.map((plan) => {
              const isCurrentPlan = plan.tier === currentTier
              const tierOrder = ['free', 'starter', 'pro', 'team']
              const isUpgrade = tierOrder.indexOf(plan.tier) > tierOrder.indexOf(currentTier)

              return (
                <div
                  key={plan.tier}
                  className={`plan-card ${plan.is_popular ? 'popular' : ''} ${isCurrentPlan ? 'current' : ''}`}
                >
                  {plan.is_popular && (
                    <div className="popular-badge">
                      <Sparkles className="w-3 h-3 mr-1 inline-block" />
                      Most Popular
                    </div>
                  )}

                  <div className="plan-header">
                    <h2 className="plan-name">{plan.name}</h2>
                    <div className="plan-price">
                      <span className="currency">$</span>
                      <span className="amount">
                        {billingPeriod === 'yearly' && plan.price_monthly > 0
                          ? Math.round(plan.price_monthly * 12 * 0.8 / 12)
                          : plan.price_monthly}
                      </span>
                      <span className="period">/month</span>
                    </div>
                    {billingPeriod === 'yearly' && plan.price_monthly > 0 && (
                      <div className="billed-yearly">
                        Billed ${Math.round(plan.price_monthly * 12 * 0.8)}/year
                      </div>
                    )}
                  </div>

                  <ul className="plan-features">
                    <li className="plan-feature-highlight">
                      <Video className="w-4 h-4 text-purple-400" />
                      {plan.videos_limit === -1 ? 'Unlimited' : plan.videos_limit} videos/mo
                    </li>
                    <li className="plan-feature-highlight">
                      <HardDrive className="w-4 h-4 text-cyan-400" />
                      {plan.storage_mb < 1024 ? (plan.storage_mb / 1024).toFixed(1) : Math.round(plan.storage_mb / 1024)} GB storage
                    </li>
                    <li className="plan-feature-highlight">
                      <Clock className="w-4 h-4 text-green-400" />
                      {plan.max_video_duration_minutes === -1
                        ? 'Unlimited duration'
                        : `Up to ${plan.max_video_duration_minutes} min videos`}
                    </li>
                    {plan.vision_analysis && (
                      <li><Check className="w-4 h-4 text-green-500" /> Vision AI</li>
                    )}
                    {plan.priority_processing && (
                      <li><Check className="w-4 h-4 text-green-500" /> Priority Processing</li>
                    )}
                  </ul>

                  <Button
                    variant={isCurrentPlan ? 'secondary' : 'default'}
                    className="w-full plan-cta"
                    onClick={() => handleSelectPlan(plan.tier)}
                    disabled={processingTier === plan.tier || isCurrentPlan}
                  >
                    {processingTier === plan.tier ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Processing...</>
                    ) : isCurrentPlan ? (
                      <><Check className="w-4 h-4 mr-2" /> Current Plan</>
                    ) : isUpgrade ? (
                      <><Crown className="w-4 h-4 mr-2" /> Upgrade to {plan.name}</>
                    ) : (
                      'Upgrade'
                    )}
                  </Button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

export default PricingModal
