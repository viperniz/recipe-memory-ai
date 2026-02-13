import React, { useState } from 'react'
import { BookOpen, Clock, GraduationCap, Lightbulb, HelpCircle, Link, ChevronDown, ChevronRight } from 'lucide-react'
import { Badge } from '../ui/badge'
import TimestampLink from './TimestampLink'

function LearnCard({ learn, sourceUrl }) {
  const [expandedSections, setExpandedSections] = useState({
    chapters: true,
    concepts: true,
    flashcards: false,
    questions: false
  })

  if (!learn) return null

  const toggleSection = (section) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }))
  }

  const difficultyColors = {
    beginner: 'bg-green-500/20 text-green-400',
    intermediate: 'bg-yellow-500/20 text-yellow-400',
    advanced: 'bg-red-500/20 text-red-400'
  }

  return (
    <div className="learn-card">
      {/* Header */}
      <div className="learn-header">
        <h1 className="learn-title">{learn.title}</h1>
        <div className="learn-meta">
          {learn.subject && (
            <Badge variant="outline">{learn.subject}</Badge>
          )}
          {learn.difficulty_level && (
            <Badge className={difficultyColors[learn.difficulty_level]}>
              {learn.difficulty_level}
            </Badge>
          )}
          {learn.duration_minutes > 0 && (
            <span className="learn-duration">
              <Clock className="w-4 h-4" />
              {learn.duration_minutes} min
            </span>
          )}
        </div>
        {learn.instructor && learn.instructor !== 'Unknown' && (
          <div className="learn-instructor">
            <GraduationCap className="w-4 h-4" />
            Instructor: {learn.instructor}
          </div>
        )}
      </div>

      {/* Learning Objectives */}
      {learn.learning_objectives && learn.learning_objectives.length > 0 && (
        <div className="learn-section">
          <h3 className="learn-section-title">
            <Lightbulb className="w-4 h-4" />
            Learning Objectives
          </h3>
          <ul className="learn-objectives">
            {learn.learning_objectives.map((obj, idx) => (
              <li key={idx}>{obj}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Chapter Markers */}
      {learn.chapter_markers && learn.chapter_markers.length > 0 && (
        <div className="learn-section">
          <button
            className="learn-section-header"
            onClick={() => toggleSection('chapters')}
          >
            {expandedSections.chapters ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            <h3>Chapter Markers ({learn.chapter_markers.length})</h3>
          </button>
          {expandedSections.chapters && (
            <div className="learn-chapters">
              {learn.chapter_markers.map((ch, idx) => (
                <div key={idx} className="learn-chapter">
                  <TimestampLink timestamp={ch.timestamp} sourceUrl={sourceUrl} />
                  <div className="learn-chapter-content">
                    <strong>{ch.title}</strong>
                    {ch.summary && <p>{ch.summary}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Key Concepts */}
      {learn.key_concepts && learn.key_concepts.length > 0 && (
        <div className="learn-section">
          <button
            className="learn-section-header"
            onClick={() => toggleSection('concepts')}
          >
            {expandedSections.concepts ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            <h3>Key Concepts ({learn.key_concepts.length})</h3>
          </button>
          {expandedSections.concepts && (
            <div className="learn-concepts">
              {learn.key_concepts.map((concept, idx) => (
                <div key={idx} className="learn-concept">
                  <div className="learn-concept-header">
                    <span className="learn-concept-name">{concept.concept}</span>
                    {concept.timestamp && (
                      <TimestampLink timestamp={concept.timestamp} sourceUrl={sourceUrl} />
                    )}
                    {concept.importance && (
                      <Badge variant="outline" className="text-xs">
                        {concept.importance}
                      </Badge>
                    )}
                  </div>
                  <p className="learn-concept-def">{concept.definition}</p>
                  {concept.example && (
                    <div className="learn-concept-example">
                      <strong>Example:</strong> {concept.example}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Flashcards */}
      {learn.flashcards && learn.flashcards.length > 0 && (
        <div className="learn-section">
          <button
            className="learn-section-header"
            onClick={() => toggleSection('flashcards')}
          >
            {expandedSections.flashcards ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            <h3>Flashcards ({learn.flashcards.length})</h3>
          </button>
          {expandedSections.flashcards && (
            <div className="learn-flashcards">
              {learn.flashcards.map((card, idx) => (
                <FlashCard key={idx} card={card} index={idx} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Practice Questions */}
      {learn.practice_questions && learn.practice_questions.length > 0 && (
        <div className="learn-section">
          <button
            className="learn-section-header"
            onClick={() => toggleSection('questions')}
          >
            {expandedSections.questions ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            <h3>Practice Questions ({learn.practice_questions.length})</h3>
          </button>
          {expandedSections.questions && (
            <div className="learn-questions">
              {learn.practice_questions.map((q, idx) => (
                <PracticeQuestion key={idx} question={q} index={idx} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Key Takeaways */}
      {learn.key_takeaways && learn.key_takeaways.length > 0 && (
        <div className="learn-section">
          <h3 className="learn-section-title">Key Takeaways</h3>
          <ul className="learn-takeaways">
            {learn.key_takeaways.map((item, idx) => (
              <li key={idx}>{item}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Resources */}
      {learn.resources && learn.resources.length > 0 && (
        <div className="learn-section">
          <h3 className="learn-section-title">
            <Link className="w-4 h-4" />
            Resources
          </h3>
          <div className="learn-resources">
            {learn.resources.map((res, idx) => (
              <div key={idx} className="learn-resource">
                <strong>{res.name}</strong>
                {res.description && <p>{res.description}</p>}
                {res.url && (
                  <a href={res.url} target="_blank" rel="noopener noreferrer">
                    {res.url}
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Summary */}
      {learn.summary && (
        <div className="learn-section">
          <h3 className="learn-section-title">Summary</h3>
          <p className="learn-summary">{learn.summary}</p>
        </div>
      )}
    </div>
  )
}

// Flashcard component with flip animation
function FlashCard({ card, index }) {
  const [flipped, setFlipped] = useState(false)

  return (
    <div
      className={`learn-flashcard ${flipped ? 'flipped' : ''}`}
      onClick={() => setFlipped(!flipped)}
    >
      <div className="learn-flashcard-inner">
        <div className="learn-flashcard-front">
          <span className="learn-flashcard-label">Q{index + 1}</span>
          <p>{card.front}</p>
          <span className="learn-flashcard-hint">Click to reveal</span>
        </div>
        <div className="learn-flashcard-back">
          <span className="learn-flashcard-label">A</span>
          <p>{card.back}</p>
        </div>
      </div>
    </div>
  )
}

// Practice question with reveal answer
function PracticeQuestion({ question, index }) {
  const [showAnswer, setShowAnswer] = useState(false)

  return (
    <div className="learn-question">
      <div className="learn-question-q">
        <HelpCircle className="w-4 h-4" />
        <span>Q{index + 1}: {question.question}</span>
      </div>
      {!showAnswer ? (
        <button
          className="learn-question-reveal"
          onClick={() => setShowAnswer(true)}
        >
          Show Answer
        </button>
      ) : (
        <div className="learn-question-a">
          <strong>Answer:</strong> {question.answer}
        </div>
      )}
    </div>
  )
}

export default LearnCard
