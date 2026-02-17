import React, { useState } from 'react'
import { X, ArrowRight, ArrowLeft, Play, BookOpen, Search, MessageSquare, Sparkles } from 'lucide-react'
import { Button } from '../ui/button'

const STEPS = [
  {
    id: 'welcome',
    title: 'Welcome to Second Mind!',
    subtitle: 'Your AI-powered research companion',
    description: 'Turn any video, lecture, or article into searchable knowledge. Second Mind watches, reads, and remembers — so you can focus on what matters.',
  },
  {
    id: 'how-it-works',
    title: 'How It Works',
    subtitle: 'Three simple steps to build your knowledge base',
    cards: [
      {
        icon: Play,
        color: '#8b5cf6',
        title: 'Add a Source',
        description: 'Paste a YouTube link, upload a video, or import a web article.'
      },
      {
        icon: Sparkles,
        color: '#06b6d4',
        title: 'AI Processes It',
        description: 'We extract key points, summaries, timestamps, and generate flashcards.'
      },
      {
        icon: Search,
        color: '#10b981',
        title: 'Search & Chat',
        description: 'Search by meaning across everything, or ask questions and get cited answers.'
      }
    ]
  },
  {
    id: 'try-it',
    title: 'Try It Now',
    subtitle: 'Process your first video in seconds',
    exampleUrl: 'https://www.youtube.com/watch?v=UF8uR6Z6KLc',
    exampleTitle: 'Steve Jobs\' Stanford Commencement Address (15 min)',
  }
]

function OnboardingModal({ onClose, onTryVideo }) {
  const [step, setStep] = useState(0)
  const currentStep = STEPS[step]
  const isLast = step === STEPS.length - 1
  const isFirst = step === 0

  const handleTryIt = () => {
    onTryVideo(STEPS[2].exampleUrl)
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content onboarding-modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>
          <X className="w-5 h-5" />
        </button>

        <div className="onboarding-body">
          {/* Step: Welcome */}
          {currentStep.id === 'welcome' && (
            <div className="onboarding-step onboarding-welcome">
              <div className="onboarding-hero-icon">
                <BookOpen className="w-10 h-10" />
              </div>
              <h2 className="onboarding-title">{currentStep.title}</h2>
              <p className="onboarding-subtitle">{currentStep.subtitle}</p>
              <p className="onboarding-description">{currentStep.description}</p>
            </div>
          )}

          {/* Step: How It Works */}
          {currentStep.id === 'how-it-works' && (
            <div className="onboarding-step">
              <h2 className="onboarding-title">{currentStep.title}</h2>
              <p className="onboarding-subtitle">{currentStep.subtitle}</p>
              <div className="onboarding-cards">
                {currentStep.cards.map((card, i) => {
                  const Icon = card.icon
                  return (
                    <div key={i} className="onboarding-card">
                      <div className="onboarding-card-icon" style={{ background: `${card.color}20`, color: card.color }}>
                        <Icon className="w-6 h-6" />
                      </div>
                      <div className="onboarding-card-step-num">{i + 1}</div>
                      <h3>{card.title}</h3>
                      <p>{card.description}</p>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Step: Try It Now */}
          {currentStep.id === 'try-it' && (
            <div className="onboarding-step onboarding-try">
              <div className="onboarding-hero-icon onboarding-hero-play">
                <Play className="w-10 h-10" />
              </div>
              <h2 className="onboarding-title">{currentStep.title}</h2>
              <p className="onboarding-subtitle">{currentStep.subtitle}</p>
              <div className="onboarding-example">
                <div className="onboarding-example-url">
                  <Play className="w-4 h-4" />
                  <span>{currentStep.exampleTitle}</span>
                </div>
                <Button onClick={handleTryIt} className="onboarding-try-btn">
                  <Sparkles className="w-4 h-4 mr-2" />
                  Process this video
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Footer: navigation */}
        <div className="onboarding-footer">
          {/* Step dots */}
          <div className="onboarding-dots">
            {STEPS.map((_, i) => (
              <button
                key={i}
                className={`onboarding-dot ${i === step ? 'active' : ''}`}
                onClick={() => setStep(i)}
              />
            ))}
          </div>

          <div className="onboarding-nav">
            {!isFirst && (
              <Button variant="ghost" onClick={() => setStep(step - 1)}>
                <ArrowLeft className="w-4 h-4 mr-1" />
                Back
              </Button>
            )}
            {isFirst && (
              <button className="onboarding-skip" onClick={onClose}>
                Skip for now
              </button>
            )}
            {!isLast ? (
              <Button onClick={() => setStep(step + 1)}>
                Next
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            ) : (
              <button className="onboarding-skip" onClick={onClose}>
                Skip for now
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default OnboardingModal
