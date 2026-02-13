import React, { useState, useEffect } from 'react'
import { Loader2, ChevronLeft, ChevronRight, Download, RotateCcw, Layers } from 'lucide-react'
import { Button } from '../ui/button'
import UpgradePrompt from '../billing/UpgradePrompt'
import axios from 'axios'
import { toast } from '../../hooks/use-toast'

function FlashcardPanel({ contentId }) {
  const [cards, setCards] = useState(null)
  const [ankiCsv, setAnkiCsv] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [isLoadingStored, setIsLoadingStored] = useState(true)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [error, setError] = useState(null)

  // Load stored flashcards on mount
  useEffect(() => {
    const loadStored = async () => {
      try {
        const token = localStorage.getItem('token')
        const response = await axios.get(
          `/api/content/${contentId}/generated/flashcards`,
          { headers: { Authorization: `Bearer ${token}` } }
        )
        if (response.data.data) {
          const stored = response.data.data
          setCards(stored.cards || [])
          setAnkiCsv(stored.anki_csv || '')
        }
      } catch (err) {
        // Silently ignore - user just hasn't generated yet
      } finally {
        setIsLoadingStored(false)
      }
    }
    loadStored()
  }, [contentId])

  const generate = async (regenerate = false) => {
    setIsGenerating(true)
    setError(null)
    try {
      const token = localStorage.getItem('token')
      const url = regenerate
        ? `/api/content/${contentId}/flashcards?regenerate=true`
        : `/api/content/${contentId}/flashcards`
      const response = await axios.post(
        url,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      )
      setCards(response.data.cards)
      setAnkiCsv(response.data.anki_csv || '')
      setCurrentIndex(0)
      setFlipped(false)
    } catch (err) {
      const detail = err.response?.data?.detail
      if (err.response?.status === 403 && typeof detail === 'object') {
        if (detail.error === 'feature_locked') {
          setError({ type: 'feature_locked', requiredTier: detail.required_tier, message: detail.message })
        } else if (detail.error === 'insufficient_credits') {
          setError({ type: 'credits', cost: detail.cost, balance: detail.balance })
        } else {
          toast({ variant: 'destructive', title: 'Access Denied', description: detail.message || 'Upgrade your plan.' })
        }
      } else {
        toast({ variant: 'destructive', title: 'Generation failed', description: typeof detail === 'string' ? detail : (detail?.message || err.message) })
      }
    } finally {
      setIsGenerating(false)
    }
  }

  const downloadAnki = () => {
    if (!ankiCsv) return
    const blob = new Blob([ankiCsv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'flashcards-anki.csv'
    document.body.appendChild(a)
    a.click()
    URL.revokeObjectURL(url)
    document.body.removeChild(a)
  }

  const goNext = () => {
    setFlipped(false)
    setCurrentIndex(prev => Math.min(prev + 1, cards.length - 1))
  }

  const goPrev = () => {
    setFlipped(false)
    setCurrentIndex(prev => Math.max(prev - 1, 0))
  }

  if (error?.type === 'feature_locked') {
    return (
      <div className="flashcard-panel">
        <UpgradePrompt type="feature_locked" requiredTier={error.requiredTier} message={error.message} inline />
      </div>
    )
  }

  if (error?.type === 'credits') {
    return (
      <div className="flashcard-panel">
        <UpgradePrompt type="insufficient_credits" cost={error.cost} balance={error.balance} inline />
      </div>
    )
  }

  if (isLoadingStored) {
    return (
      <div className="flashcard-panel">
        <div className="flashcard-generate">
          <Loader2 className="w-6 h-6 animate-spin text-purple-500 mx-auto mb-3" />
          <p>Loading...</p>
        </div>
      </div>
    )
  }

  if (!cards) {
    return (
      <div className="flashcard-panel">
        <div className="flashcard-generate">
          <Layers className="w-10 h-10 text-purple-500 mx-auto mb-3" />
          <p>Generate flashcards from this source to test your knowledge</p>
          <Button onClick={() => generate(false)} disabled={isGenerating}>
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              'Generate Flashcards'
            )}
          </Button>
        </div>
      </div>
    )
  }

  const card = cards[currentIndex]

  return (
    <div className="flashcard-panel">
      <div className="flashcard-container">
        <div
          className={`flashcard ${flipped ? 'flipped' : ''}`}
          onClick={() => setFlipped(!flipped)}
        >
          <div className="flashcard-inner">
            <div className="flashcard-front">
              <span className="flashcard-label">Question {currentIndex + 1}</span>
              <p>{card.front}</p>
              {card.difficulty && (
                <span className={`flashcard-difficulty ${card.difficulty}`}>
                  {card.difficulty}
                </span>
              )}
              <span className="flashcard-hint">Click to flip</span>
            </div>
            <div className="flashcard-back">
              <span className="flashcard-label">Answer</span>
              <p>{card.back}</p>
            </div>
          </div>
        </div>

        <div className="flashcard-nav">
          <Button variant="outline" size="sm" onClick={goPrev} disabled={currentIndex === 0}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span>{currentIndex + 1} / {cards.length}</span>
          <Button variant="outline" size="sm" onClick={goNext} disabled={currentIndex === cards.length - 1}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>

        <div className="flashcard-actions">
          <Button variant="outline" size="sm" onClick={() => { setFlipped(false); setCurrentIndex(0) }}>
            <RotateCcw className="w-4 h-4 mr-1" />
            Restart
          </Button>
          {ankiCsv && (
            <Button variant="outline" size="sm" onClick={downloadAnki}>
              <Download className="w-4 h-4 mr-1" />
              Anki CSV
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => generate(true)} disabled={isGenerating}>
            {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Regenerate'}
          </Button>
        </div>
      </div>
    </div>
  )
}

export default FlashcardPanel
