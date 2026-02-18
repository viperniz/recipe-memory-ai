import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { billingApi } from '../api/billing'
import { toast } from '../hooks/use-toast'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'
import { Skeleton } from '../components/ui/skeleton'
import {
  Check,
  X,
  Loader2,
  Sparkles,
  Crown,
  GraduationCap
} from 'lucide-react'
import { Link } from 'react-router-dom'

const API_BASE = import.meta.env.VITE_API_URL || '/api'

const COMPARISON_SECTIONS = [
  {
    heading: 'Research & Analysis',
    rows: [
      { label: 'Monthly processing allowance', researcher: '25 hours', scholar: '75 hours', department: '200 hours' },
      { label: 'Content length limit', researcher: '30 min', scholar: '2 hours', department: 'Unlimited' },
      { label: 'AI depth', researcher: 'Standard', scholar: 'Research-grade', department: 'Research-grade' },
      { label: 'Visual understanding (diagrams, code, slides)', researcher: false, scholar: true, department: true },
      { label: 'Language translation', researcher: 'Auto-detect', scholar: '20+ languages', department: '20+ languages (priority)' },
      { label: 'Search', researcher: 'Meaning-based', scholar: 'Advanced + API', department: 'Advanced + API' },
    ]
  },
  {
    heading: 'Learning Tools',
    rows: [
      { label: 'Flashcards', researcher: true, scholar: true, department: true },
      { label: 'Mind maps', researcher: false, scholar: true, department: true },
      { label: 'Step-by-step guides', researcher: false, scholar: true, department: true },
    ]
  },
  {
    heading: 'Workflow & Export',
    rows: [
      { label: 'Export formats', researcher: 'PDF, MD, TXT', scholar: '+ JSON, Obsidian', department: '+ DOCX' },
      { label: 'Collections', researcher: '10', scholar: '20', department: 'Unlimited' },
      { label: 'Team members', researcher: '1', scholar: '1', department: 'Up to 10' },
      { label: 'Support', researcher: 'Email', scholar: 'Priority', department: 'Dedicated' },
    ]
  }
]

const TIER_TAGLINE = {
  starter: 'For the curious mind getting serious about learning.',
  pro: 'The full second mind. For researchers, developers & students who refuse to lose an insight.',
  team: 'Shared knowledge for teams that learn together.',
}

function PricingPage() {
  const { user, token, isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const [plans, setPlans] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [billingPeriod, setBillingPeriod] = useState('monthly')
  const [processingTier, setProcessingTier] = useState(null)
  const [currentTier, setCurrentTier] = useState('free')

  useEffect(() => {
    document.title = 'Pricing — Second Mind'
  }, [])

  useEffect(() => {
    const loadData = async () => {
      try {
        const plansData = await billingApi.getPlans()
        setPlans(plansData)

        if (isAuthenticated && token) {
          try {
            const sub = await billingApi.getSubscription(token)
            setCurrentTier(sub.tier || 'free')
          } catch {
            // Ignore
          }
        }
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
    loadData()
  }, [isAuthenticated, token])

  const handleSelectPlan = async (tier) => {
    if (!isAuthenticated) {
      navigate('/register', { state: { redirectTo: '/pricing', selectedTier: tier } })
      return
    }

    if (tier === 'free' || tier === currentTier) {
      navigate('/app')
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

  const tierOrder = ['free', 'starter', 'pro', 'team']

  const isUpgradeTier = (tier) => {
    return tierOrder.indexOf(tier) > tierOrder.indexOf(currentTier)
  }

  const getDisplayPrice = (plan) => {
    if (billingPeriod === 'yearly' && plan.price_monthly > 0) {
      return Math.round(plan.price_monthly * 12 * 0.8 / 12)
    }
    return plan.price_monthly
  }

  const getFirstMonthCallout = (plan) => {
    if (billingPeriod === 'yearly') {
      return 'First month free (included in trial)'
    }
    const halfPrice = (plan.price_monthly / 2).toFixed(2)
    return `First month $${halfPrice} after free trial`
  }

  if (isLoading) {
    return (
      <div className="pricing-page">
        <div className="pricing-container">
          <div className="pricing-header">
            <Skeleton className="h-10 w-48 mx-auto" />
          </div>
          <div className="plans-grid">
            {[1, 2, 3].map(i => (
              <div key={i} className="plan-card">
                <Skeleton className="h-8 w-24 mb-4" />
                <Skeleton className="h-16 w-32 mb-6" />
                <div className="space-y-3">
                  {[1, 2, 3, 4].map(j => (
                    <Skeleton key={j} className="h-5 w-full" />
                  ))}
                </div>
                <Skeleton className="h-12 w-full mt-6" />
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="landing-page">
      <nav className="pricing-topbar">
        <Link to="/" className="pricing-topbar-logo">
          <Sparkles className="w-5 h-5" />
          <span>Second Mind</span>
        </Link>
        <button
          className="pricing-topbar-close"
          onClick={() => navigate(isAuthenticated ? '/app' : '/')}
          title="Close"
        >
          <X className="w-5 h-5" />
        </button>
      </nav>
      <div className="pricing-page" id="main-content">
        <div className="pricing-container">
          <div className="pricing-header">
            <h1>Your research is only as good as what you remember.</h1>
            <p className="pricing-subtitle">
              Stop losing insights to forgotten tabs and half-finished notes. Build a knowledge system that works as hard as you do.
            </p>
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

          <div className="plans-grid">
            {plans.map((plan) => {
              const isCurrentPlan = plan.tier === currentTier
              const isUpgrade = isUpgradeTier(plan.tier)
              const displayPrice = getDisplayPrice(plan)

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

                  {isCurrentPlan && (
                    <div className="current-badge">
                      <Crown className="w-3 h-3 mr-1 inline-block" />
                      Current Plan
                    </div>
                  )}

                  <div className="plan-header">
                    <h2 className="plan-name">{plan.name}</h2>
                    <p className="plan-tagline">{TIER_TAGLINE[plan.tier]}</p>
                    <div className="plan-price">
                      <span className="currency">$</span>
                      <span className="amount">{displayPrice}</span>
                      <span className="period">/month</span>
                    </div>
                    {billingPeriod === 'yearly' && plan.price_monthly > 0 && (
                      <div className="billed-yearly">
                        <span className="price-strikethrough">${plan.price_monthly}</span>
                        {' '}Billed ${Math.round(plan.price_monthly * 12 * 0.8)}/year
                      </div>
                    )}
                    {plan.price_monthly > 0 && (
                      <div className="plan-first-month">
                        {getFirstMonthCallout(plan)}
                      </div>
                    )}
                  </div>

                  <ul className="plan-features">
                    {plan.features?.map((feature, i) => (
                      <li key={i}>
                        <Check className="w-4 h-4 text-green-500 shrink-0" />
                        {feature}
                      </li>
                    ))}
                  </ul>

                  <Button
                    variant={isCurrentPlan ? 'secondary' : 'default'}
                    className="w-full plan-cta"
                    onClick={() => handleSelectPlan(plan.tier)}
                    disabled={processingTier === plan.tier || isCurrentPlan}
                  >
                    {processingTier === plan.tier ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Processing...
                      </>
                    ) : isCurrentPlan ? (
                      <>
                        <Check className="w-4 h-4 mr-2" />
                        Current Plan
                      </>
                    ) : isUpgrade ? (
                      'Start Free Trial'
                    ) : (
                      'Downgrade'
                    )}
                  </Button>
                </div>
              )
            })}
          </div>

          {/* Feature Comparison Table — always visible */}
          <div className="feature-comparison">
            <h2>Feature Comparison</h2>
            <div className="comparison-table">
              <div className="comparison-header">
                <div className="comparison-cell feature-name">Feature</div>
                <div className="comparison-cell plan-name">Researcher</div>
                <div className="comparison-cell plan-name">Scholar</div>
                <div className="comparison-cell plan-name">Department</div>
              </div>
              {COMPARISON_SECTIONS.map((section, sIdx) => (
                <React.Fragment key={sIdx}>
                  <div className="comparison-category">
                    <div className="comparison-cell feature-name">{section.heading}</div>
                  </div>
                  {section.rows.map((row, rIdx) => (
                    <div key={`${sIdx}-${rIdx}`} className="comparison-row">
                      <div className="comparison-cell feature-name">{row.label}</div>
                      {['researcher', 'scholar', 'department'].map(tier => {
                        const val = row[tier]
                        return (
                          <div key={tier} className="comparison-cell">
                            {val === true ? (
                              <Check className="w-4 h-4 text-green-500 mx-auto" />
                            ) : val === false ? (
                              <X className="w-4 h-4 text-zinc-600 mx-auto" />
                            ) : (
                              <span className="text-zinc-300">{val}</span>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  ))}
                </React.Fragment>
              ))}
            </div>
          </div>

          {/* Education Discount Banner */}
          <div className="education-banner">
            <div className="education-banner-inner">
              <div className="education-banner-icon">
                <GraduationCap className="w-10 h-10" />
              </div>
              <div className="education-banner-content">
                <h3>Built for education. Priced like it.</h3>
                <p>
                  Students and educators get 40% off Scholar — full second-mind features for <strong>$17.99/mo</strong>.
                  Because the best research tool shouldn't be the one you can't afford.
                </p>
              </div>
              <div className="education-banner-action">
                {isAuthenticated ? (
                  <Button
                    variant="outline"
                    className="education-cta"
                    onClick={async () => {
                      try {
                        const res = await fetch(`${API_BASE}/auth/verify-edu`, {
                          method: 'POST',
                          headers: { Authorization: `Bearer ${token}` }
                        })
                        const data = await res.json()
                        if (data.verified) {
                          toast({ variant: 'success', title: 'Verified!', description: 'Your .edu email has been verified. You can now subscribe at the education rate.' })
                        } else {
                          toast({ variant: 'destructive', title: 'Not eligible', description: data.message || 'Only .edu emails qualify.' })
                        }
                      } catch {
                        toast({ variant: 'destructive', title: 'Error', description: 'Failed to verify email.' })
                      }
                    }}
                  >
                    <GraduationCap className="w-4 h-4 mr-2" />
                    Verify with your .edu email
                  </Button>
                ) : (
                  <Button variant="outline" className="education-cta" onClick={() => navigate('/register')}>
                    <GraduationCap className="w-4 h-4 mr-2" />
                    Verify with your .edu email
                  </Button>
                )}
              </div>
            </div>
          </div>

          <div className="pricing-footer">
            <p className="pricing-footer-tagline">You do the thinking. Your second mind remembers everything else.</p>
            <p className="pricing-footer-fine">7-day free trial on all plans. 50% off your first month. Cancel anytime.</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default PricingPage
