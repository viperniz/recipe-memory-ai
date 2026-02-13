import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { billingApi } from '../../api/billing'
import UsageMeter from './UsageMeter'
import { Button } from '../ui/button'
import { Badge } from '../ui/badge'
import { Skeleton } from '../ui/skeleton'
import { Crown, ArrowUpRight, RefreshCw } from 'lucide-react'

function UsageOverview({ compact = false, showUpgradeButton = true }) {
  const { token } = useAuth()
  const navigate = useNavigate()
  const [limits, setLimits] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchLimits = async () => {
    if (!token) {
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      const data = await billingApi.getUsageLimits(token)
      setLimits(data)
      setError(null)
    } catch (err) {
      console.error('Failed to fetch limits:', err)
      // More specific error message
      if (err.response?.status === 401) {
        setError('Session expired')
      } else if (err.response?.status === 404) {
        setError('Endpoint not found - restart API server')
      } else {
        setError(err.response?.data?.detail || err.message || 'Connection error')
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchLimits()
  }, [token])

  if (loading) {
    return (
      <div className="usage-overview">
        <Skeleton className="h-4 w-20 mb-2" />
        <Skeleton className="h-2 w-full mb-2" />
        <Skeleton className="h-2 w-full" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="usage-overview usage-overview-error">
        <p className="text-xs text-zinc-500 mb-1">Usage unavailable</p>
        <p className="text-xs text-zinc-600 mb-2">{error}</p>
        <Button size="sm" variant="ghost" onClick={fetchLimits} className="w-full">
          <RefreshCw className="w-3 h-3 mr-1" />
          Retry
        </Button>
      </div>
    )
  }

  if (!limits) return null

  const tier = limits.tier || 'free'
  const isNearLimit = limits.videos?.percentage >= 80 || limits.storage_mb?.percentage >= 80
  const isAtLimit = !limits.within_limits

  if (compact) {
    return (
      <div className="usage-overview-compact">
        <div className="usage-overview-tier">
          <Badge variant={tier === 'free' ? 'secondary' : tier === 'starter' ? 'outline' : tier === 'pro' ? 'default' : 'warning'}>
            {tier.toUpperCase()}
          </Badge>
          {isAtLimit && (
            <Badge variant="destructive" className="ml-1">
              Limit
            </Badge>
          )}
        </div>
        <UsageMeter
          type="videos"
          used={limits.videos?.used || 0}
          limit={limits.videos?.limit || 5}
          compact
        />
      </div>
    )
  }

  return (
    <div className={`usage-overview ${isAtLimit ? 'usage-overview-at-limit' : ''}`}>
      <div className="usage-overview-header">
        <div className="usage-overview-tier">
          <Badge variant={tier === 'free' ? 'secondary' : tier === 'starter' ? 'outline' : tier === 'pro' ? 'default' : 'warning'}>
            {tier.toUpperCase()}
          </Badge>
        </div>
        <Button
          size="sm"
          variant="ghost"
          className="usage-overview-refresh"
          onClick={fetchLimits}
        >
          <RefreshCw className="w-3 h-3" />
        </Button>
      </div>

      <div className="usage-overview-meters">
        <UsageMeter
          type="videos"
          used={limits.videos?.used || 0}
          limit={limits.videos?.limit || 5}
        />
        <UsageMeter
          type="storage"
          used={limits.storage_mb?.used || 0}
          limit={limits.storage_mb?.limit || 500}
        />
        {limits.collections && (
          <UsageMeter
            type="collections"
            used={limits.collections?.used || 0}
            limit={limits.collections?.limit || 3}
          />
        )}
      </div>

      {showUpgradeButton && tier === 'free' && (
        <Button
          size="sm"
          className="usage-overview-upgrade w-full mt-2"
          onClick={() => navigate('/pricing')}
        >
          {isAtLimit ? (
            <>
              <Crown className="w-3 h-3 mr-1" />
              Upgrade Now
            </>
          ) : (
            <>
              <ArrowUpRight className="w-3 h-3 mr-1" />
              Get Pro
            </>
          )}
        </Button>
      )}

      {isNearLimit && !isAtLimit && tier === 'free' && (
        <p className="usage-overview-warning text-xs text-yellow-600 mt-2 text-center">
          Running low on space
        </p>
      )}
    </div>
  )
}

export default UsageOverview
