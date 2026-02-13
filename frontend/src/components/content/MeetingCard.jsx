import React, { useState } from 'react'
import { Users, CheckSquare, AlertTriangle, HelpCircle, Clock, Calendar, ChevronDown, ChevronRight, Check, Circle } from 'lucide-react'
import { Badge } from '../ui/badge'
import TimestampLink from './TimestampLink'

function MeetingCard({ meeting, sourceUrl }) {
  const [expandedSections, setExpandedSections] = useState({
    agenda: true,
    actions: true,
    decisions: true,
    discussions: false,
    blockers: false
  })
  const [checkedActions, setCheckedActions] = useState(new Set())

  if (!meeting) return null

  const toggleSection = (section) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }))
  }

  const toggleAction = (idx) => {
    const newChecked = new Set(checkedActions)
    if (newChecked.has(idx)) {
      newChecked.delete(idx)
    } else {
      newChecked.add(idx)
    }
    setCheckedActions(newChecked)
  }

  const priorityColors = {
    high: 'bg-red-500/20 text-red-400 border-red-500/30',
    medium: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    low: 'bg-green-500/20 text-green-400 border-green-500/30'
  }

  const severityColors = {
    critical: 'bg-red-500/20 text-red-400',
    high: 'bg-orange-500/20 text-orange-400',
    medium: 'bg-yellow-500/20 text-yellow-400',
    low: 'bg-blue-500/20 text-blue-400'
  }

  return (
    <div className="meeting-card">
      {/* Header */}
      <div className="meeting-header">
        <h1 className="meeting-title">{meeting.title}</h1>
        <div className="meeting-meta">
          {meeting.meeting_type && (
            <Badge variant="outline">{meeting.meeting_type}</Badge>
          )}
          {meeting.date && (
            <span className="meeting-date">
              <Calendar className="w-4 h-4" />
              {meeting.date}
            </span>
          )}
          {meeting.duration_minutes > 0 && (
            <span className="meeting-duration">
              <Clock className="w-4 h-4" />
              {meeting.duration_minutes} min
            </span>
          )}
        </div>
      </div>

      {/* TL;DR */}
      {meeting.tldr && (
        <div className="meeting-tldr">
          <strong>TL;DR</strong>
          <p>{meeting.tldr}</p>
        </div>
      )}

      {/* Attendees */}
      {meeting.attendees && meeting.attendees.length > 0 && (
        <div className="meeting-attendees">
          <Users className="w-4 h-4" />
          <span>
            {meeting.attendees.map(a =>
              typeof a === 'object' ? a.name : a
            ).join(', ')}
          </span>
        </div>
      )}

      {/* Agenda */}
      {meeting.agenda && meeting.agenda.length > 0 && (
        <div className="meeting-section">
          <button
            className="meeting-section-header"
            onClick={() => toggleSection('agenda')}
          >
            {expandedSections.agenda ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            <h3>Agenda ({meeting.agenda.length} items)</h3>
          </button>
          {expandedSections.agenda && (
            <div className="meeting-agenda">
              {meeting.agenda.map((item, idx) => (
                <div key={idx} className="meeting-agenda-item">
                  <span className="meeting-agenda-time">
                    <TimestampLink timestamp={item.timestamp_start} sourceUrl={sourceUrl} />
                    {item.timestamp_end && <> - <TimestampLink timestamp={item.timestamp_end} sourceUrl={sourceUrl} /></>}
                  </span>
                  <span className="meeting-agenda-topic">{item.topic}</span>
                  {item.presenter && (
                    <span className="meeting-agenda-presenter">({item.presenter})</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Action Items */}
      {meeting.action_items && meeting.action_items.length > 0 && (
        <div className="meeting-section meeting-section-actions">
          <button
            className="meeting-section-header"
            onClick={() => toggleSection('actions')}
          >
            {expandedSections.actions ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            <CheckSquare className="w-4 h-4" />
            <h3>Action Items ({meeting.action_items.length})</h3>
          </button>
          {expandedSections.actions && (
            <div className="meeting-actions">
              {meeting.action_items.map((action, idx) => (
                <div
                  key={idx}
                  className={`meeting-action ${checkedActions.has(idx) ? 'checked' : ''}`}
                  onClick={() => toggleAction(idx)}
                >
                  <div className="meeting-action-check">
                    {checkedActions.has(idx) ? (
                      <Check className="w-4 h-4" />
                    ) : (
                      <Circle className="w-4 h-4" />
                    )}
                  </div>
                  <div className="meeting-action-content">
                    <div className="meeting-action-task">
                      {typeof action === 'object' ? action.task : action}
                    </div>
                    {typeof action === 'object' && (
                      <div className="meeting-action-meta">
                        {action.owner && (
                          <span className="meeting-action-owner">
                            <Users className="w-3 h-3" />
                            {action.owner}
                          </span>
                        )}
                        {action.deadline && (
                          <span className="meeting-action-deadline">
                            <Calendar className="w-3 h-3" />
                            {action.deadline}
                          </span>
                        )}
                        {action.priority && (
                          <Badge className={priorityColors[action.priority]}>
                            {action.priority}
                          </Badge>
                        )}
                      </div>
                    )}
                    {typeof action === 'object' && action.context && (
                      <p className="meeting-action-context">{action.context}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Decisions */}
      {meeting.decisions && meeting.decisions.length > 0 && (
        <div className="meeting-section">
          <button
            className="meeting-section-header"
            onClick={() => toggleSection('decisions')}
          >
            {expandedSections.decisions ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            <h3>Decisions ({meeting.decisions.length})</h3>
          </button>
          {expandedSections.decisions && (
            <div className="meeting-decisions">
              {meeting.decisions.map((dec, idx) => (
                <div key={idx} className="meeting-decision">
                  <div className="meeting-decision-header">
                    <span className="meeting-decision-title">{dec.decision}</span>
                    {dec.timestamp && (
                      <TimestampLink timestamp={dec.timestamp} sourceUrl={sourceUrl} />
                    )}
                  </div>
                  {dec.made_by && (
                    <div className="meeting-decision-by">Decision by: {dec.made_by}</div>
                  )}
                  {dec.reasoning && (
                    <p className="meeting-decision-reasoning">{dec.reasoning}</p>
                  )}
                  {dec.alternatives_considered && dec.alternatives_considered.length > 0 && (
                    <div className="meeting-decision-alts">
                      <strong>Alternatives considered:</strong> {dec.alternatives_considered.join(', ')}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Key Discussions */}
      {meeting.key_discussions && meeting.key_discussions.length > 0 && (
        <div className="meeting-section">
          <button
            className="meeting-section-header"
            onClick={() => toggleSection('discussions')}
          >
            {expandedSections.discussions ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            <h3>Key Discussions ({meeting.key_discussions.length})</h3>
          </button>
          {expandedSections.discussions && (
            <div className="meeting-discussions">
              {meeting.key_discussions.map((disc, idx) => (
                <div key={idx} className="meeting-discussion">
                  <div className="meeting-discussion-header">
                    <strong>{disc.topic}</strong>
                    {disc.timestamp_start && (
                      <span className="meeting-discussion-time">
                        <TimestampLink timestamp={disc.timestamp_start} sourceUrl={sourceUrl} />
                        {disc.timestamp_end && <> - <TimestampLink timestamp={disc.timestamp_end} sourceUrl={sourceUrl} /></>}
                      </span>
                    )}
                  </div>
                  <p>{disc.summary}</p>
                  {disc.outcome && (
                    <div className="meeting-discussion-outcome">
                      <strong>Outcome:</strong> {disc.outcome}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Blockers */}
      {meeting.blockers && meeting.blockers.length > 0 && (
        <div className="meeting-section">
          <button
            className="meeting-section-header"
            onClick={() => toggleSection('blockers')}
          >
            {expandedSections.blockers ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            <AlertTriangle className="w-4 h-4 text-yellow-400" />
            <h3>Blockers & Risks ({meeting.blockers.length})</h3>
          </button>
          {expandedSections.blockers && (
            <div className="meeting-blockers">
              {meeting.blockers.map((blocker, idx) => (
                <div key={idx} className="meeting-blocker">
                  <div className="meeting-blocker-header">
                    <span>{blocker.issue}</span>
                    {blocker.severity && (
                      <Badge className={severityColors[blocker.severity]}>
                        {blocker.severity}
                      </Badge>
                    )}
                  </div>
                  {blocker.raised_by && (
                    <div className="meeting-blocker-by">Raised by: {blocker.raised_by}</div>
                  )}
                  {blocker.mitigation && (
                    <div className="meeting-blocker-mitigation">
                      <strong>Mitigation:</strong> {blocker.mitigation}
                    </div>
                  )}
                  {blocker.owner && (
                    <div className="meeting-blocker-owner">Owner: {blocker.owner}</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Open Questions */}
      {meeting.questions_raised && meeting.questions_raised.length > 0 && (
        <div className="meeting-section">
          <h3 className="meeting-section-title">
            <HelpCircle className="w-4 h-4" />
            Open Questions
          </h3>
          <div className="meeting-questions">
            {meeting.questions_raised.filter(q => !q.answered).map((q, idx) => (
              <div key={idx} className="meeting-question">
                <span>{q.question}</span>
                {q.asked_by && <span className="meeting-question-by">— {q.asked_by}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Next Steps */}
      {meeting.next_steps && meeting.next_steps.length > 0 && (
        <div className="meeting-section">
          <h3 className="meeting-section-title">Next Steps</h3>
          <div className="meeting-next-steps">
            {meeting.next_steps.map((step, idx) => (
              <div key={idx} className="meeting-next-step">
                <span>{step.step}</span>
                {step.owner && <span className="meeting-next-step-owner">({step.owner})</span>}
                {step.timeline && <span className="meeting-next-step-timeline">{step.timeline}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Follow-up Meeting */}
      {meeting.follow_up_meeting && meeting.follow_up_meeting.needed && (
        <div className="meeting-followup">
          <Calendar className="w-4 h-4" />
          <span>Follow-up meeting needed</span>
          {meeting.follow_up_meeting.suggested_date && (
            <span>: {meeting.follow_up_meeting.suggested_date}</span>
          )}
        </div>
      )}
    </div>
  )
}

export default MeetingCard
