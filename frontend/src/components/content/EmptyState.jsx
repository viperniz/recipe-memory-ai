import React from 'react'
import { FolderOpen, Plus, Search, ArrowRight, Sparkles } from 'lucide-react'
import { Button } from '../ui/button'

const QUICK_START_STEPS = [
  {
    number: '1',
    icon: Plus,
    title: 'Add Content',
    description: 'Paste a YouTube URL or web article link in the New Note tab.'
  },
  {
    number: '2',
    icon: Sparkles,
    title: 'AI Extracts Notes',
    description: 'Get summaries, key points, and structured notes automatically.'
  },
  {
    number: '3',
    icon: Search,
    title: 'Search & Organize',
    description: 'Search across all content, create collections, and export.'
  }
]

function EmptyState({ type = 'library', message, submessage, onNavigate }) {
  if (type === 'collection') {
    return (
      <div className="empty-state">
        <FolderOpen className="w-12 h-12 mx-auto mb-4 text-zinc-600" />
        <p className="text-zinc-300">{message || 'This collection is empty.'}</p>
        <p className="text-zinc-500 text-sm mt-2">{submessage || 'Add content from the Library using the + button.'}</p>
      </div>
    )
  }

  return (
    <div className="empty-state-enhanced">
      {/* Quick Start Guide */}
      <div className="empty-state-header">
        <div className="empty-state-icon-wrapper">
          <Sparkles className="w-10 h-10 text-purple-400" />
        </div>
        <h2>Welcome to Your Library</h2>
        <p>Get started in 3 easy steps</p>
      </div>

      <div className="quick-start-steps">
        {QUICK_START_STEPS.map((step, i) => {
          const Icon = step.icon
          return (
            <div key={i} className="quick-start-step">
              <div className="quick-start-step-number">{step.number}</div>
              <div className="quick-start-step-icon">
                <Icon className="w-5 h-5" />
              </div>
              <h3>{step.title}</h3>
              <p>{step.description}</p>
            </div>
          )
        })}
      </div>

      {/* CTA Button */}
      <div className="empty-state-cta">
        <Button size="lg" onClick={() => onNavigate?.('new')}>
          <Plus className="w-5 h-5 mr-2" />
          Add Your First Video
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
        <Button variant="outline" size="lg" onClick={() => onNavigate?.('search')}>
          <Search className="w-5 h-5 mr-2" />
          Search YouTube
        </Button>
      </div>
    </div>
  )
}

export default EmptyState
