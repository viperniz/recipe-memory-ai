import React from 'react'

function VisionMockup() {
  return (
    <div className="feat-mockup feat-mockup--vision">
      <div className="feat-mockup__video-frame">
        <div className="feat-mockup__video-bar">
          <span className="feat-mockup__dot" /><span className="feat-mockup__dot" /><span className="feat-mockup__dot" />
        </div>
        <div className="feat-mockup__video-canvas">
          <div className="feat-mockup__bbox feat-mockup__bbox--1">Whiteboard Text</div>
          <div className="feat-mockup__bbox feat-mockup__bbox--2">Code Block</div>
          <div className="feat-mockup__scene-line" />
          <div className="feat-mockup__scene-line short" />
        </div>
      </div>
      <div className="feat-mockup__sidebar">
        <div className="feat-mockup__sidebar-title">Extracted Text</div>
        <div className="feat-mockup__sidebar-line" />
        <div className="feat-mockup__sidebar-line med" />
        <div className="feat-mockup__sidebar-line short" />
        <div className="feat-mockup__sidebar-line" />
        <div className="feat-mockup__sidebar-line med" />
      </div>
    </div>
  )
}

function NotesMockup() {
  return (
    <div className="feat-mockup feat-mockup--notes">
      <div className="feat-mockup__notes-header">
        <div className="feat-mockup__notes-tag">Summary</div>
        <div className="feat-mockup__notes-line" />
        <div className="feat-mockup__notes-line med" />
      </div>
      <div className="feat-mockup__notes-body">
        <div className="feat-mockup__notes-section">
          <div className="feat-mockup__notes-label">Key Points</div>
          <div className="feat-mockup__notes-bullet"><span className="feat-mockup__bullet-dot" /><div className="feat-mockup__notes-line" /></div>
          <div className="feat-mockup__notes-bullet"><span className="feat-mockup__bullet-dot" /><div className="feat-mockup__notes-line med" /></div>
          <div className="feat-mockup__notes-bullet"><span className="feat-mockup__bullet-dot" /><div className="feat-mockup__notes-line short" /></div>
        </div>
        <div className="feat-mockup__notes-section">
          <div className="feat-mockup__notes-label">Timestamps</div>
          <div className="feat-mockup__ts-row"><span className="feat-mockup__ts-badge">0:00</span><div className="feat-mockup__notes-line" /></div>
          <div className="feat-mockup__ts-row"><span className="feat-mockup__ts-badge">3:42</span><div className="feat-mockup__notes-line med" /></div>
          <div className="feat-mockup__ts-row"><span className="feat-mockup__ts-badge">8:15</span><div className="feat-mockup__notes-line short" /></div>
        </div>
      </div>
    </div>
  )
}

function SearchMockup() {
  return (
    <div className="feat-mockup feat-mockup--search">
      <div className="feat-mockup__search-bar">
        <div className="feat-mockup__search-icon">&#128269;</div>
        <div className="feat-mockup__search-text">mitosis vs meiosis</div>
      </div>
      <div className="feat-mockup__search-results">
        <div className="feat-mockup__search-card">
          <div className="feat-mockup__search-card-title" />
          <div className="feat-mockup__search-highlight" />
          <div className="feat-mockup__search-meta">
            <span className="feat-mockup__ts-badge">12:34</span>
            <div className="feat-mockup__search-score">98% match</div>
          </div>
        </div>
        <div className="feat-mockup__search-card">
          <div className="feat-mockup__search-card-title shorter" />
          <div className="feat-mockup__search-highlight shorter" />
          <div className="feat-mockup__search-meta">
            <span className="feat-mockup__ts-badge">5:21</span>
            <div className="feat-mockup__search-score">91% match</div>
          </div>
        </div>
        <div className="feat-mockup__search-card">
          <div className="feat-mockup__search-card-title" />
          <div className="feat-mockup__search-highlight med" />
          <div className="feat-mockup__search-meta">
            <span className="feat-mockup__ts-badge">22:07</span>
            <div className="feat-mockup__search-score">85% match</div>
          </div>
        </div>
      </div>
    </div>
  )
}

function ToolsMockup() {
  return (
    <div className="feat-mockup feat-mockup--tools">
      <div className="feat-mockup__tools-gen">
        <div className="feat-mockup__tools-gen-label">Generating Flashcards...</div>
        <div className="feat-mockup__tools-progress">
          <div className="feat-mockup__tools-progress-bar" />
        </div>
      </div>
      <div className="feat-mockup__tools-cards">
        <div className="feat-mockup__flashcard">
          <div className="feat-mockup__flashcard-label">Q</div>
          <div className="feat-mockup__notes-line" />
          <div className="feat-mockup__notes-line short" />
        </div>
        <div className="feat-mockup__flashcard feat-mockup__flashcard--answer">
          <div className="feat-mockup__flashcard-label">A</div>
          <div className="feat-mockup__notes-line" />
          <div className="feat-mockup__notes-line med" />
          <div className="feat-mockup__notes-line short" />
        </div>
      </div>
    </div>
  )
}

const MOCKUP_MAP = {
  vision: VisionMockup,
  notes: NotesMockup,
  search: SearchMockup,
  tools: ToolsMockup,
}

export default function FeatureMockup({ type }) {
  const Component = MOCKUP_MAP[type]
  if (!Component) return null
  return <Component />
}
