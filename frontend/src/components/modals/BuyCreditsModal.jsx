import React, { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { billingApi } from '../../api/billing'
import { toast } from '../../hooks/use-toast'
import { Progress } from '../ui/progress'
import { X, Coins, Loader2, ShoppingCart } from 'lucide-react'

function BuyCreditsModal({ isOpen, onClose }) {
  const { token } = useAuth()
  const [packs, setPacks] = useState(null)
  const [subscription, setSubscription] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [buyingPack, setBuyingPack] = useState(null)

  useEffect(() => {
    if (!isOpen || !token) return
    setIsLoading(true)
    Promise.all([
      billingApi.getTopupPacks(token).catch(() => null),
      billingApi.getSubscription(token).catch(() => null)
    ]).then(([packsData, sub]) => {
      setPacks(packsData)
      setSubscription(sub)
    }).finally(() => setIsLoading(false))
  }, [isOpen, token])

  const handleBuy = async (packId) => {
    setBuyingPack(packId)
    try {
      const { checkout_url } = await billingApi.purchaseTopup(token, packId)
      window.location.href = checkout_url
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Failed to start checkout',
        description: err.response?.data?.detail || err.message
      })
      setBuyingPack(null)
    }
  }

  if (!isOpen) return null

  const creditBalance = subscription?.credit_balance ?? 0
  const creditsMonthly = subscription?.credits_monthly ?? 50
  const monthlyBalance = subscription?.monthly_balance ?? creditBalance
  const topupBalance = subscription?.topup_balance ?? 0
  const creditPercentage = creditsMonthly > 0 ? Math.min((monthlyBalance / creditsMonthly) * 100, 100) : 0

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content buy-credits-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Buy Extra Usage</h2>
          <button className="modal-close" onClick={onClose}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="modal-body">
          {isLoading ? (
            <div className="buy-credits-loading">
              <Loader2 className="w-6 h-6 animate-spin" style={{ color: '#a78bfa' }} />
            </div>
          ) : (
            <>
              {/* Current balance summary */}
              <div className="buy-credits-balance">
                <div className="buy-credits-balance-row">
                  <span><Coins className="w-4 h-4 inline-block mr-2" style={{ color: '#71717a' }} />Monthly allowance</span>
                  <span>{monthlyBalance} / {creditsMonthly}</span>
                </div>
                <Progress value={creditPercentage} className="h-1.5" />
                {topupBalance > 0 && (
                  <div className="buy-credits-balance-row" style={{ marginTop: 8 }}>
                    <span><ShoppingCart className="w-4 h-4 inline-block mr-2" style={{ color: '#71717a' }} />Top-up balance</span>
                    <span style={{ color: '#a78bfa', fontWeight: 600 }}>{topupBalance}</span>
                  </div>
                )}
                <div className="buy-credits-balance-total">
                  <span>Total available</span>
                  <span>{creditBalance}</span>
                </div>
              </div>

              {/* Top-up packs */}
              {packs?.topup_allowed && packs.packs?.length > 0 ? (
                <>
                  <p className="buy-credits-desc">
                    Top-ups never expire and are used after your monthly allowance runs out.
                  </p>
                  <div className="buy-credits-grid">
                    {packs.packs.map(pack => (
                      <button
                        key={pack.id}
                        className={`buy-credits-pack ${!pack.available ? 'disabled' : ''}`}
                        onClick={() => pack.available && handleBuy(pack.id)}
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
                </>
              ) : (
                <p className="buy-credits-desc">
                  Upgrade to a paid plan to purchase extra top-up packs.
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default BuyCreditsModal
