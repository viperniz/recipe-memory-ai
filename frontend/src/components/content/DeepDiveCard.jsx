import React, { useState } from 'react'
import { Search, Lightbulb, GitBranch, Shield, Layers, Target, HelpCircle, Wrench, BookOpen, ChevronDown, ChevronRight, Clock } from 'lucide-react'
import { Badge } from '../ui/badge'
import TimestampLink from './TimestampLink'

function DeepDiveCard({ deepdive, sourceUrl }) {
  const [expandedSections, setExpandedSections] = useState({
    thesis: true,
    themes: true,
    arguments: false,
    counterpoints: false,
    frameworks: false,
    evidence: false,
    connections: false,
    insights: true,
    applications: false,
    questions: false
  })

  if (!deepdive) return null

  const toggleSection = (section) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }))
  }

  const strengthColors = {
    strong: 'bg-green-500/20 text-green-400',
    moderate: 'bg-yellow-500/20 text-yellow-400',
    weak: 'bg-orange-500/20 text-orange-400',
    unsupported: 'bg-red-500/20 text-red-400'
  }

  const difficultyColors = {
    easy: 'bg-green-500/20 text-green-400',
    moderate: 'bg-yellow-500/20 text-yellow-400',
    advanced: 'bg-red-500/20 text-red-400'
  }

  const SectionHeader = ({ icon: Icon, title, section, count }) => (
    <button className="deepdive-section-header" onClick={() => toggleSection(section)}>
      <div className="deepdive-section-title">
        <Icon className="w-4 h-4" />
        <h3>{title}</h3>
        {count > 0 && <span className="deepdive-section-count">{count}</span>}
      </div>
      {expandedSections[section] ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
    </button>
  )

  return (
    <div className="deepdive-card">
      {/* Header */}
      <div className="deepdive-header">
        <div className="deepdive-header-meta">
          <Badge variant="outline" className="deepdive-badge">Deep Dive</Badge>
          {deepdive.speaker && deepdive.speaker !== 'Unknown' && (
            <span className="deepdive-speaker">{deepdive.speaker}</span>
          )}
        </div>
      </div>

      {/* Thesis */}
      {deepdive.thesis && (
        <div className="deepdive-thesis">
          <SectionHeader icon={Target} title="Core Thesis" section="thesis" count={0} />
          {expandedSections.thesis && (
            <div className="deepdive-thesis-content">
              <p>{deepdive.thesis}</p>
            </div>
          )}
        </div>
      )}

      {/* Summary */}
      {deepdive.summary && (
        <div className="deepdive-summary">
          <p>{deepdive.summary}</p>
        </div>
      )}

      {/* Themes */}
      {deepdive.themes?.length > 0 && (
        <div className="deepdive-section">
          <SectionHeader icon={Layers} title="Themes" section="themes" count={deepdive.themes.length} />
          {expandedSections.themes && (
            <div className="deepdive-section-content">
              {deepdive.themes.map((theme, idx) => (
                <div key={idx} className="deepdive-theme-item">
                  <div className="deepdive-theme-name">{theme.theme}</div>
                  <p className="deepdive-theme-desc">{theme.description}</p>
                  {theme.significance && (
                    <p className="deepdive-theme-sig">{theme.significance}</p>
                  )}
                  {theme.timestamps?.length > 0 && (
                    <div className="deepdive-timestamps">
                      {theme.timestamps.map((ts, i) => (
                        <TimestampLink key={i} timestamp={ts} sourceUrl={sourceUrl} />
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Key Insights */}
      {deepdive.key_insights?.length > 0 && (
        <div className="deepdive-section">
          <SectionHeader icon={Lightbulb} title="Key Insights" section="insights" count={deepdive.key_insights.length} />
          {expandedSections.insights && (
            <div className="deepdive-section-content">
              {deepdive.key_insights.map((item, idx) => (
                <div key={idx} className="deepdive-insight-item">
                  <div className="deepdive-insight-text">{item.insight}</div>
                  {item.reasoning && <p className="deepdive-insight-reason">{item.reasoning}</p>}
                  {item.timestamp && (
                    <TimestampLink timestamp={item.timestamp} sourceUrl={sourceUrl} />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Arguments */}
      {deepdive.arguments?.length > 0 && (
        <div className="deepdive-section">
          <SectionHeader icon={Shield} title="Arguments" section="arguments" count={deepdive.arguments.length} />
          {expandedSections.arguments && (
            <div className="deepdive-section-content">
              {deepdive.arguments.map((arg, idx) => (
                <div key={idx} className="deepdive-argument-item">
                  <div className="deepdive-argument-header">
                    <span className="deepdive-argument-claim">{arg.claim}</span>
                    {arg.strength && (
                      <Badge className={strengthColors[arg.strength] || ''}>
                        {arg.strength}
                      </Badge>
                    )}
                  </div>
                  {arg.speaker && <span className="deepdive-argument-speaker">— {arg.speaker}</span>}
                  {arg.evidence && <p className="deepdive-argument-evidence">{arg.evidence}</p>}
                  {arg.timestamp && (
                    <TimestampLink timestamp={arg.timestamp} sourceUrl={sourceUrl} />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Counterpoints */}
      {deepdive.counterpoints?.length > 0 && (
        <div className="deepdive-section">
          <SectionHeader icon={GitBranch} title="Counterpoints & Nuances" section="counterpoints" count={deepdive.counterpoints.length} />
          {expandedSections.counterpoints && (
            <div className="deepdive-section-content">
              {deepdive.counterpoints.map((cp, idx) => (
                <div key={idx} className="deepdive-counterpoint-item">
                  <p className="deepdive-counterpoint-text">{cp.point}</p>
                  {cp.context && <p className="deepdive-counterpoint-ctx">Re: {cp.context}</p>}
                  {cp.timestamp && (
                    <TimestampLink timestamp={cp.timestamp} sourceUrl={sourceUrl} />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Frameworks */}
      {deepdive.frameworks?.length > 0 && (
        <div className="deepdive-section">
          <SectionHeader icon={Wrench} title="Frameworks & Models" section="frameworks" count={deepdive.frameworks.length} />
          {expandedSections.frameworks && (
            <div className="deepdive-section-content">
              {deepdive.frameworks.map((fw, idx) => (
                <div key={idx} className="deepdive-framework-item">
                  <div className="deepdive-framework-name">{fw.name}</div>
                  <p className="deepdive-framework-desc">{fw.description}</p>
                  {fw.timestamp && (
                    <TimestampLink timestamp={fw.timestamp} sourceUrl={sourceUrl} />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Connections */}
      {deepdive.connections?.length > 0 && (
        <div className="deepdive-section">
          <SectionHeader icon={GitBranch} title="Connections" section="connections" count={deepdive.connections.length} />
          {expandedSections.connections && (
            <div className="deepdive-section-content">
              {deepdive.connections.map((conn, idx) => (
                <div key={idx} className="deepdive-connection-item">
                  <div className="deepdive-connection-nodes">
                    <span className="deepdive-connection-node">{conn.from}</span>
                    <span className="deepdive-connection-arrow">→</span>
                    <span className="deepdive-connection-node">{conn.to}</span>
                  </div>
                  <p className="deepdive-connection-rel">{conn.relationship}</p>
                  {conn.insight && <p className="deepdive-connection-insight">{conn.insight}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Evidence */}
      {deepdive.evidence?.length > 0 && (
        <div className="deepdive-section">
          <SectionHeader icon={BookOpen} title="Evidence" section="evidence" count={deepdive.evidence.length} />
          {expandedSections.evidence && (
            <div className="deepdive-section-content">
              {deepdive.evidence.map((ev, idx) => (
                <div key={idx} className="deepdive-evidence-item">
                  <div className="deepdive-evidence-header">
                    <Badge variant="outline">{ev.type}</Badge>
                    {ev.supports && <span className="deepdive-evidence-supports">supports: {ev.supports}</span>}
                  </div>
                  <p className="deepdive-evidence-content">{ev.content}</p>
                  {ev.timestamp && (
                    <TimestampLink timestamp={ev.timestamp} sourceUrl={sourceUrl} />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Practical Applications */}
      {deepdive.practical_applications?.length > 0 && (
        <div className="deepdive-section">
          <SectionHeader icon={Target} title="Practical Applications" section="applications" count={deepdive.practical_applications.length} />
          {expandedSections.applications && (
            <div className="deepdive-section-content">
              {deepdive.practical_applications.map((app, idx) => (
                <div key={idx} className="deepdive-application-item">
                  <div className="deepdive-application-header">
                    <span>{app.application}</span>
                    {app.difficulty && (
                      <Badge className={difficultyColors[app.difficulty] || ''}>
                        {app.difficulty}
                      </Badge>
                    )}
                  </div>
                  {app.context && <p className="deepdive-application-ctx">{app.context}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Questions Raised */}
      {deepdive.questions_raised?.length > 0 && (
        <div className="deepdive-section">
          <SectionHeader icon={HelpCircle} title="Open Questions" section="questions" count={deepdive.questions_raised.length} />
          {expandedSections.questions && (
            <div className="deepdive-section-content">
              <ul className="deepdive-questions-list">
                {deepdive.questions_raised.map((q, idx) => (
                  <li key={idx}>{q}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Related Concepts */}
      {deepdive.related_concepts?.length > 0 && (
        <div className="deepdive-related">
          <span className="deepdive-related-label">Related:</span>
          <div className="deepdive-related-tags">
            {deepdive.related_concepts.map((concept, idx) => (
              <Badge key={idx} variant="outline">{concept}</Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default DeepDiveCard
