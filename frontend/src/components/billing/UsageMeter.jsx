import React from 'react'
import { Progress } from '../ui/progress'
import { Coins, AlertTriangle } from 'lucide-react'

function UsageMeter({
  balance = 0,
  creditsMonthly = 15,
  showLabel = true,
  compact = false
}) {
  const percentage = creditsMonthly > 0 ? Math.min((balance / creditsMonthly) * 100, 100) : 0
  const isLow = percentage <= 20 && percentage > 0
  const isEmpty = balance <= 0

  if (compact) {
    return (
      <div className="usage-meter-compact">
        <Coins className="w-3 h-3" />
        <span className={isEmpty ? 'text-red-500' : isLow ? 'text-yellow-500' : ''}>
          {balance} / {creditsMonthly}
        </span>
      </div>
    )
  }

  return (
    <div className="usage-meter">
      {showLabel && (
        <div className="usage-meter-header">
          <span className="usage-meter-label">
            <Coins className="w-4 h-4 inline-block mr-2" />
            Usage
          </span>
          <span className={`usage-meter-value ${isEmpty ? 'text-red-500' : isLow ? 'text-yellow-500' : ''}`}>
            {balance} / {creditsMonthly}
            {isEmpty && <AlertTriangle className="w-4 h-4 inline-block ml-1" />}
          </span>
        </div>
      )}
      <Progress
        value={percentage}
        className={`h-2 ${isEmpty ? 'bg-red-200' : isLow ? 'bg-yellow-200' : ''}`}
      />
      {isLow && !isEmpty && (
        <p className="usage-meter-warning text-yellow-600 text-xs mt-1">
          Allowance running low
        </p>
      )}
      {isEmpty && (
        <p className="usage-meter-warning text-red-600 text-xs mt-1">
          No allowance remaining
        </p>
      )}
    </div>
  )
}

export default UsageMeter
