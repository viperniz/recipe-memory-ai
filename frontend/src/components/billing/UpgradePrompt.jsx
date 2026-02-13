import React from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../ui/button'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../ui/card'
import { Badge } from '../ui/badge'
import {
  Sparkles,
  Crown,
  ArrowRight,
  X,
  Coins,
  Lock,
  AlertTriangle
} from 'lucide-react'

/**
 * UpgradePrompt component — supports three error types:
 * - 'feature_locked' → feature requires higher plan
 * - 'limit_reached' → storage/duration/collection limit hit
 * - 'insufficient_credits' → not enough credits
 */
function UpgradePrompt({
  type = 'insufficient_credits',
  cost,
  balance,
  requiredTier,
  message: customMessage,
  onClose,
  inline = false,
  compact = false
}) {
  const navigate = useNavigate()

  const handleUpgrade = () => {
    navigate('/pricing')
    if (onClose) onClose()
  }

  // Determine title, icon, message, and CTA based on type
  let title = ''
  let Icon = Coins
  let message = ''
  let ctaText = ''

  if (type === 'feature_locked') {
    title = 'Feature Locked'
    Icon = Lock
    message = customMessage || `This feature requires ${requiredTier ? requiredTier.charAt(0).toUpperCase() + requiredTier.slice(1) : 'a higher'}+ plan.`
    ctaText = 'Upgrade Plan'
  } else if (type === 'limit_reached') {
    title = 'Limit Reached'
    Icon = AlertTriangle
    message = customMessage || 'You\'ve reached a limit on your current plan.'
    ctaText = 'Upgrade Plan'
  } else {
    title = 'Usage Limit Reached'
    Icon = Coins
    if (cost != null && balance != null) {
      message = 'Not enough allowance remaining for this action.'
    } else {
      message = customMessage || 'You need more allowance to use this feature.'
    }
    ctaText = 'Upgrade Plan'
  }

  if (compact) {
    return (
      <div className="upgrade-prompt-compact">
        <Icon className="w-4 h-4 text-purple-500" />
        <span className="text-sm">{message}</span>
        <Button size="sm" variant="default" onClick={handleUpgrade}>
          {ctaText}
        </Button>
      </div>
    )
  }

  if (inline) {
    return (
      <div className="upgrade-prompt-inline">
        <div className="upgrade-prompt-inline-icon">
          <Icon className="w-5 h-5 text-purple-500" />
        </div>
        <div className="upgrade-prompt-inline-content">
          <h4 className="font-medium">{title}</h4>
          <p className="text-sm text-zinc-500">{message}</p>
        </div>
        <Button size="sm" onClick={handleUpgrade}>
          {ctaText}
          <ArrowRight className="w-4 h-4 ml-1" />
        </Button>
      </div>
    )
  }

  return (
    <Card className="upgrade-prompt-card">
      <CardHeader className="relative">
        {onClose && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-zinc-400 hover:text-zinc-600"
          >
            <X className="w-5 h-5" />
          </button>
        )}
        <div className="upgrade-prompt-icon-wrapper">
          <Icon className="w-8 h-8 text-purple-500" />
        </div>
        <CardTitle className="text-center">{title}</CardTitle>
        <CardDescription className="text-center">
          {message}
        </CardDescription>
      </CardHeader>

      <CardContent>
        <div className="upgrade-prompt-features">
          <p className="text-sm font-medium text-zinc-500 mb-2">Upgrade for more processing power:</p>
          <ul className="space-y-2">
            <li className="flex items-center gap-2 text-sm">
              <Sparkles className="w-4 h-4 text-purple-500" />
              Researcher — $8.99/mo
            </li>
            <li className="flex items-center gap-2 text-sm">
              <Sparkles className="w-4 h-4 text-purple-500" />
              Scholar — $22.99/mo
            </li>
            <li className="flex items-center gap-2 text-sm">
              <Sparkles className="w-4 h-4 text-purple-500" />
              Department — $44.99/mo
            </li>
          </ul>
        </div>

        <div className="upgrade-prompt-tiers mt-4 flex gap-2 justify-center flex-wrap">
          <Badge variant="secondary">Researcher $8.99/mo</Badge>
          <Badge variant="default">Scholar $22.99/mo</Badge>
          <Badge variant="secondary">Department $44.99/mo</Badge>
        </div>
      </CardContent>

      <CardFooter className="flex flex-col gap-2">
        <Button className="w-full" onClick={handleUpgrade}>
          <Crown className="w-4 h-4 mr-2" />
          {ctaText}
        </Button>
        {onClose && (
          <Button variant="ghost" className="w-full" onClick={onClose}>
            Maybe Later
          </Button>
        )}
      </CardFooter>
    </Card>
  )
}

export default UpgradePrompt
