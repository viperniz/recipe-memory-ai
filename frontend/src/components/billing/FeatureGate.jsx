import React, { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { billingApi } from '../../api/billing'
import UpgradePrompt from './UpgradePrompt'
import { Skeleton } from '../ui/skeleton'
import { Coins, Lock } from 'lucide-react'

/**
 * CreditGate component - wraps content that costs credits.
 * Checks credit balance to determine if user can afford the action.
 *
 * Usage:
 * <CreditGate cost={3}>
 *   <FlashcardPanel />
 * </CreditGate>
 */
function CreditGate({
  cost = 0,
  children,
  renderLocked,
  showUpgradeInline = false,
  fallback = null
}) {
  const { token } = useAuth()
  const [loading, setLoading] = useState(true)
  const [balance, setBalance] = useState(0)

  useEffect(() => {
    const checkCredits = async () => {
      if (!token) {
        setLoading(false)
        return
      }
      try {
        const result = await billingApi.getCredits(token)
        setBalance(result.balance)
      } catch (err) {
        console.error('Failed to check credits:', err)
        setBalance(0)
      } finally {
        setLoading(false)
      }
    }
    checkCredits()
  }, [token])

  if (loading) {
    return (
      <div className="feature-gate-loading">
        <Skeleton className="h-32 w-full" />
      </div>
    )
  }

  const hasCredits = cost === 0 || balance >= cost

  if (hasCredits) {
    return children
  }

  if (renderLocked) {
    return renderLocked(cost, balance)
  }

  if (fallback) {
    return fallback
  }

  if (showUpgradeInline) {
    return <UpgradePrompt type="insufficient_credits" cost={cost} balance={balance} inline />
  }

  return (
    <div className="feature-gate-locked">
      <div className="feature-gate-locked-content">
        <Coins className="w-8 h-8 text-zinc-400 mb-2" />
        <p className="text-zinc-500 text-sm">This costs {cost} credits. You have {balance}.</p>
        <UpgradePrompt type="insufficient_credits" cost={cost} balance={balance} compact />
      </div>
    </div>
  )
}

/**
 * Hook for checking credit balance
 */
export function useCreditBalance() {
  const { token } = useAuth()
  const [loading, setLoading] = useState(true)
  const [balance, setBalance] = useState(0)
  const [creditsMonthly, setCreditsMonthly] = useState(50)
  const [tier, setTier] = useState('free')
  const [error, setError] = useState(null)

  const refresh = async () => {
    if (!token) {
      setLoading(false)
      return
    }
    try {
      setLoading(true)
      const result = await billingApi.getCredits(token)
      setBalance(result.balance)
      setCreditsMonthly(result.credits_monthly)
      setTier(result.tier)
      setError(null)
    } catch (err) {
      console.error('Failed to get credit balance:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh()
  }, [token])

  return { loading, balance, creditsMonthly, tier, error, refresh }
}

/**
 * Hook for checking if user can afford a specific cost
 */
export function useCreditCheck(cost) {
  const { loading, balance, creditsMonthly, tier, error, refresh } = useCreditBalance()
  return {
    loading,
    hasCredits: balance >= cost,
    balance,
    cost,
    creditsMonthly,
    tier,
    error,
    refresh
  }
}

export function useUsageLimits() {
  const { loading, balance, creditsMonthly, tier, error, refresh } = useCreditBalance()
  return {
    loading,
    limits: { balance, credits_monthly: creditsMonthly },
    error,
    refresh,
    canAddVideo: true,
    canAddCollection: true,
    tier
  }
}

/**
 * Hook for checking if user has access to a tier-gated feature
 */
export function useFeatureAccess(feature) {
  const { token } = useAuth()
  const [loading, setLoading] = useState(true)
  const [hasAccess, setHasAccess] = useState(false)
  const [requiredTier, setRequiredTier] = useState(null)
  const [currentTier, setCurrentTier] = useState('free')

  useEffect(() => {
    const check = async () => {
      if (!token) {
        setLoading(false)
        return
      }
      try {
        const result = await billingApi.checkFeature(token, feature)
        setHasAccess(result.has_access)
        setRequiredTier(result.required_tier)
        setCurrentTier(result.current_tier)
      } catch (err) {
        console.error(`Failed to check feature ${feature}:`, err)
        setHasAccess(false)
      } finally {
        setLoading(false)
      }
    }
    check()
  }, [token, feature])

  return { loading, hasAccess, requiredTier, currentTier }
}

/**
 * FeatureGate component - wraps content that requires a specific tier.
 *
 * Usage:
 * <FeatureGate feature="vision_analysis">
 *   <VisionToggle />
 * </FeatureGate>
 */
export function FeatureGate({
  feature,
  children,
  fallback = null,
  showUpgradeInline = false
}) {
  const { loading, hasAccess, requiredTier } = useFeatureAccess(feature)

  if (loading) {
    return (
      <div className="feature-gate-loading">
        <Skeleton className="h-32 w-full" />
      </div>
    )
  }

  if (hasAccess) {
    return children
  }

  if (fallback) {
    return fallback
  }

  if (showUpgradeInline) {
    return <UpgradePrompt type="feature_locked" requiredTier={requiredTier} inline />
  }

  return (
    <div className="feature-gate-locked">
      <div className="feature-gate-locked-content">
        <Lock className="w-8 h-8 text-zinc-400 mb-2" />
        <p className="text-zinc-500 text-sm">
          This feature requires {requiredTier ? requiredTier.charAt(0).toUpperCase() + requiredTier.slice(1) : 'a higher'}+ plan.
        </p>
        <UpgradePrompt type="feature_locked" requiredTier={requiredTier} compact />
      </div>
    </div>
  )
}

export { CreditGate }
export default CreditGate
