import React, { useState } from 'react'
import { Badge } from '../ui/badge'
import {
  ChevronDown, ChevronRight, FileText, Code, Film, Briefcase,
  Target, BookOpen, AlertTriangle, CheckCircle, Clock, Users,
  Lightbulb, Shield, Layers, List, ExternalLink, ClipboardList,
  Grid2X2, TrendingUp, TrendingDown, Compass, HelpCircle, Link, Rocket
} from 'lucide-react'

const REPORT_TYPE_CONFIG = {
  thesis: { label: 'Thesis', color: '#a855f7', icon: FileText },
  development_plan: { label: 'Development Plan', hcolor: '#3b82f6', icon: Code },
  script: { label: 'Script', color: '#f97316', icon: Film },
  executive_brief: { label: 'Executive Brief', color: '#22c55e', icon: Briefcase },
  prd: { label: 'PRD', color: '#06b6d4', icon: ClipboardList },
  swot: { label: 'SWOT Analysis', color: '#eab308', icon: Grid2X2 },
}

function ReportCard({ report }) {
  const [expandedSections, setExpandedSections] = useState({})

  if (!report?.result) return null

  const result = report.result
  const typeConfig = REPORT_TYPE_CONFIG[report.report_type] || REPORT_TYPE_CONFIG.thesis

  const toggleSection = (key) => {
    setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const isExpanded = (key, defaultOpen = false) => {
    return expandedSections[key] ?? defaultOpen
  }

  const SectionHeader = ({ icon: Icon, title, sectionKey, count, defaultOpen = false }) => (
    <button className="report-section-header" onClick={() => toggleSection(sectionKey)}>
      <div className="report-section-title">
        <Icon className="w-4 h-4" />
        <h3>{title}</h3>
        {count > 0 && <span className="report-section-count">{count}</span>}
      </div>
      {isExpanded(sectionKey, defaultOpen) ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
    </button>
  )

  const renderThesis = () => (
    <>
      {result.abstract && (
        <div className="report-block">
          <SectionHeader icon={BookOpen} title="Abstract" sectionKey="abstract" count={0} defaultOpen={true} />
          {isExpanded('abstract', true) && <div className="report-block-content"><p>{result.abstract}</p></div>}
        </div>
      )}
      {result.thesis_statement && (
        <div className="report-block report-highlight">
          <SectionHeader icon={Target} title="Thesis Statement" sectionKey="thesis" count={0} defaultOpen={true} />
          {isExpanded('thesis', true) && <div className="report-block-content"><p className="report-thesis-text">{result.thesis_statement}</p></div>}
        </div>
      )}
      {result.introduction && (
        <div className="report-block">
          <SectionHeader icon={FileText} title="Introduction" sectionKey="intro" count={0} />
          {isExpanded('intro') && <div className="report-block-content"><p>{result.introduction}</p></div>}
        </div>
      )}
      {result.literature_context && (
        <div className="report-block">
          <SectionHeader icon={Layers} title="Literature Context" sectionKey="literature" count={0} />
          {isExpanded('literature') && <div className="report-block-content"><p>{result.literature_context}</p></div>}
        </div>
      )}
      {result.arguments?.length > 0 && (
        <div className="report-block">
          <SectionHeader icon={Lightbulb} title="Arguments" sectionKey="arguments" count={result.arguments.length} defaultOpen={true} />
          {isExpanded('arguments', true) && (
            <div className="report-block-content">
              {result.arguments.map((arg, i) => (
                <div key={i} className="report-argument">
                  <h4>{arg.claim}</h4>
                  <div className="report-argument-evidence"><strong>Evidence:</strong> {arg.evidence}</div>
                  <div className="report-argument-analysis"><strong>Analysis:</strong> {arg.analysis}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {result.counterarguments?.length > 0 && (
        <div className="report-block">
          <SectionHeader icon={Shield} title="Counterarguments" sectionKey="counter" count={result.counterarguments.length} />
          {isExpanded('counter') && (
            <div className="report-block-content">
              {result.counterarguments.map((ca, i) => (
                <div key={i} className="report-counter">
                  <p><strong>{ca.point}</strong></p>
                  <p>{ca.response}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {result.synthesis && (
        <div className="report-block">
          <SectionHeader icon={Layers} title="Synthesis" sectionKey="synthesis" count={0} />
          {isExpanded('synthesis') && <div className="report-block-content"><p>{result.synthesis}</p></div>}
        </div>
      )}
      {result.conclusion && (
        <div className="report-block report-highlight">
          <SectionHeader icon={CheckCircle} title="Conclusion" sectionKey="conclusion" count={0} defaultOpen={true} />
          {isExpanded('conclusion', true) && <div className="report-block-content"><p>{result.conclusion}</p></div>}
        </div>
      )}
    </>
  )

  const renderDevelopmentPlan = () => (
    <>
      {result.executive_summary && (
        <div className="report-block report-highlight">
          <SectionHeader icon={Target} title="Executive Summary" sectionKey="execsum" count={0} defaultOpen={true} />
          {isExpanded('execsum', true) && <div className="report-block-content"><p>{result.executive_summary}</p></div>}
        </div>
      )}
      {result.objectives?.length > 0 && (
        <div className="report-block">
          <SectionHeader icon={CheckCircle} title="Objectives" sectionKey="objectives" count={result.objectives.length} defaultOpen={true} />
          {isExpanded('objectives', true) && (
            <div className="report-block-content">
              <ul>{result.objectives.map((obj, i) => <li key={i}>{obj}</li>)}</ul>
            </div>
          )}
        </div>
      )}
      {result.current_state_analysis && (
        <div className="report-block">
          <SectionHeader icon={Layers} title="Current State" sectionKey="current" count={0} />
          {isExpanded('current') && <div className="report-block-content"><p>{result.current_state_analysis}</p></div>}
        </div>
      )}
      {result.phases?.length > 0 && (
        <div className="report-block">
          <SectionHeader icon={List} title="Phases" sectionKey="phases" count={result.phases.length} defaultOpen={true} />
          {isExpanded('phases', true) && (
            <div className="report-block-content">
              {result.phases.map((phase, i) => (
                <div key={i} className="report-phase">
                  <div className="report-phase-header">
                    <h4>{phase.name}</h4>
                    {phase.duration && <Badge variant="outline">{phase.duration}</Badge>}
                  </div>
                  {phase.goals?.length > 0 && (
                    <div className="report-phase-goals">
                      <strong>Goals:</strong>
                      <ul>{phase.goals.map((g, j) => <li key={j}>{g}</li>)}</ul>
                    </div>
                  )}
                  {phase.tasks?.length > 0 && (
                    <div className="report-phase-tasks">
                      {phase.tasks.map((t, j) => (
                        <div key={j} className="report-task">
                          <span className={`report-priority report-priority-${t.priority || 'medium'}`}>{t.priority || 'medium'}</span>
                          <span>{t.task}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {phase.deliverables?.length > 0 && (
                    <div className="report-phase-deliverables">
                      <strong>Deliverables:</strong> {phase.deliverables.join(', ')}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {result.risk_assessment?.length > 0 && (
        <div className="report-block">
          <SectionHeader icon={AlertTriangle} title="Risk Assessment" sectionKey="risks" count={result.risk_assessment.length} />
          {isExpanded('risks') && (
            <div className="report-block-content">
              {result.risk_assessment.map((r, i) => (
                <div key={i} className="report-risk">
                  <div className="report-risk-header">
                    <span className="report-risk-name">{r.risk}</span>
                    <Badge variant="outline" className={`report-prob-${r.probability}`}>{r.probability}</Badge>
                    <Badge variant="outline" className={`report-impact-${r.impact}`}>{r.impact} impact</Badge>
                  </div>
                  <p className="report-risk-mitigation"><strong>Mitigation:</strong> {r.mitigation}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {result.success_metrics?.length > 0 && (
        <div className="report-block">
          <SectionHeader icon={Target} title="Success Metrics" sectionKey="metrics" count={result.success_metrics.length} />
          {isExpanded('metrics') && (
            <div className="report-block-content">
              <ul>{result.success_metrics.map((m, i) => <li key={i}>{m}</li>)}</ul>
            </div>
          )}
        </div>
      )}
      {result.timeline_summary && (
        <div className="report-block">
          <SectionHeader icon={Clock} title="Timeline" sectionKey="timeline" count={0} />
          {isExpanded('timeline') && <div className="report-block-content"><p>{result.timeline_summary}</p></div>}
        </div>
      )}
    </>
  )

  const renderScript = () => (
    <>
      {result.hook && (
        <div className="report-block report-highlight">
          <SectionHeader icon={Target} title="Hook" sectionKey="hook" count={0} defaultOpen={true} />
          {isExpanded('hook', true) && <div className="report-block-content"><p className="report-script-text">{result.hook}</p></div>}
        </div>
      )}
      {(result.target_audience || result.estimated_duration) && (
        <div className="report-meta-row">
          {result.target_audience && <Badge variant="outline"><Users className="w-3 h-3 mr-1" />{result.target_audience}</Badge>}
          {result.estimated_duration && <Badge variant="outline"><Clock className="w-3 h-3 mr-1" />{result.estimated_duration}</Badge>}
        </div>
      )}
      {result.sections?.length > 0 && (
        <div className="report-block">
          <SectionHeader icon={List} title="Sections" sectionKey="sections" count={result.sections.length} defaultOpen={true} />
          {isExpanded('sections', true) && (
            <div className="report-block-content">
              {result.sections.map((sec, i) => (
                <div key={i} className="report-script-section">
                  <h4>{sec.title}</h4>
                  <p className="report-script-text">{sec.content}</p>
                  {sec.visual_notes && <p className="report-visual-notes"><Film className="w-3 h-3 inline mr-1" />{sec.visual_notes}</p>}
                  {sec.transition && <p className="report-transition"><em>Transition: {sec.transition}</em></p>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {result.call_to_action && (
        <div className="report-block report-highlight">
          <SectionHeader icon={Target} title="Call to Action" sectionKey="cta" count={0} defaultOpen={true} />
          {isExpanded('cta', true) && <div className="report-block-content"><p>{result.call_to_action}</p></div>}
        </div>
      )}
      {result.outro && (
        <div className="report-block">
          <SectionHeader icon={FileText} title="Outro" sectionKey="outro" count={0} />
          {isExpanded('outro') && <div className="report-block-content"><p>{result.outro}</p></div>}
        </div>
      )}
      {result.production_notes?.length > 0 && (
        <div className="report-block">
          <SectionHeader icon={Lightbulb} title="Production Notes" sectionKey="prodnotes" count={result.production_notes.length} />
          {isExpanded('prodnotes') && (
            <div className="report-block-content">
              <ul>{result.production_notes.map((n, i) => <li key={i}>{n}</li>)}</ul>
            </div>
          )}
        </div>
      )}
    </>
  )

  const renderExecutiveBrief = () => (
    <>
      {result.situation_overview && (
        <div className="report-block">
          <SectionHeader icon={Layers} title="Situation Overview" sectionKey="situation" count={0} defaultOpen={true} />
          {isExpanded('situation', true) && <div className="report-block-content"><p>{result.situation_overview}</p></div>}
        </div>
      )}
      {result.key_findings?.length > 0 && (
        <div className="report-block">
          <SectionHeader icon={Lightbulb} title="Key Findings" sectionKey="findings" count={result.key_findings.length} defaultOpen={true} />
          {isExpanded('findings', true) && (
            <div className="report-block-content">
              {result.key_findings.map((f, i) => (
                <div key={i} className="report-finding">
                  <h4>{f.finding}</h4>
                  <p>{f.significance}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {result.analysis && (
        <div className="report-block">
          <SectionHeader icon={FileText} title="Analysis" sectionKey="analysis" count={0} />
          {isExpanded('analysis') && <div className="report-block-content"><p>{result.analysis}</p></div>}
        </div>
      )}
      {result.options?.length > 0 && (
        <div className="report-block">
          <SectionHeader icon={List} title="Options" sectionKey="options" count={result.options.length} defaultOpen={true} />
          {isExpanded('options', true) && (
            <div className="report-block-content report-options-grid">
              {result.options.map((opt, i) => (
                <div key={i} className="report-option-card">
                  <h4>{opt.option}</h4>
                  {opt.pros?.length > 0 && (
                    <div className="report-option-pros">
                      <strong>Pros:</strong>
                      <ul>{opt.pros.map((p, j) => <li key={j}>{p}</li>)}</ul>
                    </div>
                  )}
                  {opt.cons?.length > 0 && (
                    <div className="report-option-cons">
                      <strong>Cons:</strong>
                      <ul>{opt.cons.map((c, j) => <li key={j}>{c}</li>)}</ul>
                    </div>
                  )}
                  {opt.cost && <p><strong>Cost:</strong> {opt.cost}</p>}
                  {opt.timeline && <p><strong>Timeline:</strong> {opt.timeline}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {result.recommendation && (
        <div className="report-block report-highlight">
          <SectionHeader icon={CheckCircle} title="Recommendation" sectionKey="recommendation" count={0} defaultOpen={true} />
          {isExpanded('recommendation', true) && <div className="report-block-content"><p>{result.recommendation}</p></div>}
        </div>
      )}
      {result.next_steps?.length > 0 && (
        <div className="report-block">
          <SectionHeader icon={Target} title="Next Steps" sectionKey="nextsteps" count={result.next_steps.length} defaultOpen={true} />
          {isExpanded('nextsteps', true) && (
            <div className="report-block-content">
              <ol>{result.next_steps.map((s, i) => <li key={i}>{s}</li>)}</ol>
            </div>
          )}
        </div>
      )}
    </>
  )

  const renderAcceptanceCriteria = (criteria) => {
    if (!criteria?.length) return null
    // Backward compat: support both string[] and {given,when,then}[]
    const isGherkin = typeof criteria[0] === 'object' && criteria[0].given
    if (isGherkin) {
      return (
        <div className="report-acceptance-criteria">
          <strong>Acceptance Criteria:</strong>
          {criteria.map((c, j) => (
            <div key={j} className="report-gherkin">
              <div><span className="report-gherkin-keyword">Given</span> {c.given}</div>
              <div><span className="report-gherkin-keyword">When</span> {c.when}</div>
              <div><span className="report-gherkin-keyword">Then</span> {c.then}</div>
            </div>
          ))}
        </div>
      )
    }
    return (
      <div className="report-acceptance-criteria">
        <strong>Acceptance Criteria:</strong>
        <ul>{criteria.map((c, j) => <li key={j}>{typeof c === 'string' ? c : JSON.stringify(c)}</li>)}</ul>
      </div>
    )
  }

  const renderSuccessMetrics = (metrics) => {
    if (!metrics?.length) return null
    const isStructured = typeof metrics[0] === 'object' && metrics[0].metric
    if (isStructured) {
      return metrics.map((m, i) => (
        <div key={i} className="report-metric-card">
          <h4>{m.metric}</h4>
          <div className="report-metric-detail"><strong>Target:</strong> {m.target}</div>
          <div className="report-metric-detail"><strong>Measurement:</strong> {m.measurement_method}</div>
        </div>
      ))
    }
    return <ul>{metrics.map((m, i) => <li key={i}>{typeof m === 'string' ? m : JSON.stringify(m)}</li>)}</ul>
  }

  const CONSTRAINT_COLORS = { technical: '#3b82f6', business: '#f97316', regulatory: '#ef4444', resource: '#a855f7' }
  const DEP_STATUS_CLASS = { ready: 'report-dep-status-ready', blocked: 'report-dep-status-blocked', unknown: 'report-dep-status-unknown' }

  const renderPrd = () => (
    <>
      {/* 1. Meta row */}
      {(result.product_name || result.version) && (
        <div className="report-meta-row">
          {result.product_name && <Badge variant="outline" style={{ borderColor: '#06b6d440', color: '#06b6d4' }}><ClipboardList className="w-3 h-3 mr-1" />{result.product_name}</Badge>}
          {result.version && <Badge variant="outline">v{result.version}</Badge>}
        </div>
      )}
      {/* 2. Overview */}
      {result.overview && (
        <div className="report-block report-highlight">
          <SectionHeader icon={BookOpen} title="Overview" sectionKey="overview" count={0} defaultOpen={true} />
          {isExpanded('overview', true) && <div className="report-block-content"><p>{result.overview}</p></div>}
        </div>
      )}
      {/* 3. Background & Context (new) */}
      {result.background_context && (
        <div className="report-block">
          <SectionHeader icon={Layers} title="Background & Context" sectionKey="background" count={0} defaultOpen={true} />
          {isExpanded('background', true) && <div className="report-block-content"><p>{result.background_context}</p></div>}
        </div>
      )}
      {/* 4. Problem Statement */}
      {result.problem_statement && (
        <div className="report-block">
          <SectionHeader icon={AlertTriangle} title="Problem Statement" sectionKey="problem" count={0} defaultOpen={true} />
          {isExpanded('problem', true) && <div className="report-block-content"><p>{result.problem_statement}</p></div>}
        </div>
      )}
      {/* 5. Goals */}
      {result.goals?.length > 0 && (
        <div className="report-block">
          <SectionHeader icon={Target} title="Goals" sectionKey="goals" count={result.goals.length} defaultOpen={true} />
          {isExpanded('goals', true) && (
            <div className="report-block-content">
              <ul>{result.goals.map((g, i) => <li key={i}>{g}</li>)}</ul>
            </div>
          )}
        </div>
      )}
      {/* 6. Target Users (collapsed) */}
      {result.target_users && (
        <div className="report-block">
          <SectionHeader icon={Users} title="Target Users" sectionKey="target_users" count={0} />
          {isExpanded('target_users') && <div className="report-block-content"><p>{result.target_users}</p></div>}
        </div>
      )}
      {/* 7. User Stories */}
      {result.user_stories?.length > 0 && (
        <div className="report-block">
          <SectionHeader icon={Users} title="User Stories" sectionKey="stories" count={result.user_stories.length} defaultOpen={true} />
          {isExpanded('stories', true) && (
            <div className="report-block-content">
              {result.user_stories.map((story, i) => (
                <div key={i} className="report-user-story">
                  <span className="report-story-persona">{story.persona}</span>
                  <span className="report-story-action">{story.action}</span>
                  <span className="report-story-benefit">{story.benefit}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {/* 8. Functional Requirements (updated acceptance criteria) */}
      {result.requirements?.functional?.length > 0 && (
        <div className="report-block">
          <SectionHeader icon={CheckCircle} title="Functional Requirements" sectionKey="functional" count={result.requirements.functional.length} defaultOpen={true} />
          {isExpanded('functional', true) && (
            <div className="report-block-content">
              {result.requirements.functional.map((req, i) => (
                <div key={i} className="report-requirement">
                  <div className="report-requirement-header">
                    <span className="report-req-id">{req.id}</span>
                    <h4>{req.title}</h4>
                    <Badge className={`report-priority report-priority-${req.priority === 'must_have' ? 'high' : req.priority === 'should_have' ? 'medium' : 'low'}`}>
                      {(req.priority || '').replace('_', ' ')}
                    </Badge>
                  </div>
                  <p>{req.description}</p>
                  {renderAcceptanceCriteria(req.acceptance_criteria)}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {/* 9. Non-Functional Requirements (collapsed) */}
      {result.requirements?.non_functional?.length > 0 && (
        <div className="report-block">
          <SectionHeader icon={Shield} title="Non-Functional Requirements" sectionKey="nonfunctional" count={result.requirements.non_functional.length} />
          {isExpanded('nonfunctional') && (
            <div className="report-block-content">
              {result.requirements.non_functional.map((req, i) => (
                <div key={i} className="report-requirement">
                  <div className="report-requirement-header">
                    <span className="report-req-id">{req.id}</span>
                    <h4>{req.title}</h4>
                    {req.category && <Badge variant="outline">{req.category}</Badge>}
                  </div>
                  <p>{req.description}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {/* 10. Assumptions (collapsed, new) */}
      {result.assumptions?.length > 0 && (
        <div className="report-block">
          <SectionHeader icon={Lightbulb} title="Assumptions" sectionKey="assumptions" count={result.assumptions.length} />
          {isExpanded('assumptions') && (
            <div className="report-block-content">
              {result.assumptions.map((a, i) => (
                <div key={i} className="report-assumption">
                  <p className="report-assumption-text">{a.assumption}</p>
                  <div className="report-assumption-meta">
                    <span><strong>Impact if wrong:</strong> {a.impact}</span>
                    <span><strong>Validation:</strong> {a.validation}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {/* 11. Constraints (collapsed, new) */}
      {result.constraints?.length > 0 && (
        <div className="report-block">
          <SectionHeader icon={Shield} title="Constraints" sectionKey="constraints" count={result.constraints.length} />
          {isExpanded('constraints') && (
            <div className="report-block-content">
              {result.constraints.map((c, i) => (
                <div key={i} className="report-constraint" style={{ borderLeftColor: CONSTRAINT_COLORS[c.type] || '#71717a' }}>
                  <div className="report-constraint-header">
                    <span className="report-constraint-text">{c.constraint}</span>
                    {c.type && <Badge variant="outline" style={{ borderColor: (CONSTRAINT_COLORS[c.type] || '#71717a') + '40', color: CONSTRAINT_COLORS[c.type] || '#71717a' }}>{c.type}</Badge>}
                  </div>
                  <p>{c.impact}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {/* 12. Dependencies (collapsed, new) */}
      {result.dependencies?.length > 0 && (
        <div className="report-block">
          <SectionHeader icon={Link} title="Dependencies" sectionKey="dependencies" count={result.dependencies.length} />
          {isExpanded('dependencies') && (
            <div className="report-block-content">
              {result.dependencies.map((d, i) => (
                <div key={i} className="report-dependency">
                  <div className="report-dependency-header">
                    <span className="report-dependency-name">{d.dependency}</span>
                    {d.type && <Badge variant="outline">{d.type.replace('_', ' ')}</Badge>}
                    {d.status && <Badge className={DEP_STATUS_CLASS[d.status] || 'report-dep-status-unknown'}>{d.status}</Badge>}
                  </div>
                  {d.detail && <p>{d.detail}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {/* 13. Risks (open, new) */}
      {result.risks?.length > 0 && (
        <div className="report-block">
          <SectionHeader icon={AlertTriangle} title="Risks" sectionKey="prd_risks" count={result.risks.length} defaultOpen={true} />
          {isExpanded('prd_risks', true) && (
            <div className="report-block-content">
              {result.risks.map((r, i) => (
                <div key={i} className="report-risk">
                  <div className="report-risk-header">
                    <span className="report-risk-name">{r.risk}</span>
                    {r.category && <Badge variant="outline">{r.category}</Badge>}
                    <Badge variant="outline" className={`report-prob-${r.probability}`}>{r.probability}</Badge>
                    <Badge variant="outline" className={`report-impact-${r.impact}`}>{r.impact} impact</Badge>
                  </div>
                  <p className="report-risk-mitigation"><strong>Mitigation:</strong> {r.mitigation}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {/* 14. Open Questions (open, new) */}
      {result.open_questions?.length > 0 && (
        <div className="report-block">
          <SectionHeader icon={HelpCircle} title="Open Questions" sectionKey="open_questions" count={result.open_questions.length} defaultOpen={true} />
          {isExpanded('open_questions', true) && (
            <div className="report-block-content">
              {result.open_questions.map((q, i) => (
                <div key={i} className="report-open-question">
                  <div className="report-open-question-header">
                    <span className="report-open-question-text">{q.question}</span>
                    {q.priority && <Badge className={`report-priority report-priority-${q.priority}`}>{q.priority}</Badge>}
                  </div>
                  {q.context && <p>{q.context}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {/* 15. Release Strategy (collapsed, new) */}
      {result.release_strategy && (
        <div className="report-block">
          <SectionHeader icon={Rocket} title="Release Strategy" sectionKey="release_strategy" count={result.release_strategy.phases?.length || 0} />
          {isExpanded('release_strategy') && (
            <div className="report-block-content">
              {result.release_strategy.phases?.map((phase, i) => (
                <div key={i} className="report-release-phase">
                  <h4>{phase.name}</h4>
                  <p><strong>Scope:</strong> {phase.scope}</p>
                  <p><strong>Success Criteria:</strong> {phase.success_criteria}</p>
                </div>
              ))}
              {result.release_strategy.feature_flags?.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  <strong style={{ fontSize: 12 }}>Feature Flags:</strong>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                    {result.release_strategy.feature_flags.map((f, i) => (
                      <span key={i} className="report-feature-flag">{f}</span>
                    ))}
                  </div>
                </div>
              )}
              {result.release_strategy.rollback_plan && (
                <div style={{ marginTop: 8 }}>
                  <strong style={{ fontSize: 12 }}>Rollback Plan:</strong>
                  <p>{result.release_strategy.rollback_plan}</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
      {/* 16. Success Metrics (collapsed, updated) */}
      {result.success_metrics?.length > 0 && (
        <div className="report-block">
          <SectionHeader icon={Target} title="Success Metrics" sectionKey="metrics" count={result.success_metrics.length} />
          {isExpanded('metrics') && (
            <div className="report-block-content">
              {renderSuccessMetrics(result.success_metrics)}
            </div>
          )}
        </div>
      )}
      {/* 17. Technical Considerations (collapsed) */}
      {result.technical_considerations && (
        <div className="report-block">
          <SectionHeader icon={Code} title="Technical Considerations" sectionKey="technical" count={0} />
          {isExpanded('technical') && <div className="report-block-content"><p>{result.technical_considerations}</p></div>}
        </div>
      )}
      {/* 18. Out of Scope (collapsed) */}
      {result.out_of_scope?.length > 0 && (
        <div className="report-block">
          <SectionHeader icon={Shield} title="Out of Scope" sectionKey="outofscope" count={result.out_of_scope.length} />
          {isExpanded('outofscope') && (
            <div className="report-block-content">
              <ul>{result.out_of_scope.map((item, i) => <li key={i}>{item}</li>)}</ul>
            </div>
          )}
        </div>
      )}
      {/* 19. Timeline (collapsed) */}
      {result.timeline && (
        <div className="report-block">
          <SectionHeader icon={Clock} title="Timeline" sectionKey="timeline" count={0} />
          {isExpanded('timeline') && <div className="report-block-content"><p>{result.timeline}</p></div>}
        </div>
      )}
    </>
  )

  const SWOT_QUADRANTS = [
    { key: 'strengths', label: 'Strengths', icon: TrendingUp, className: 'report-swot-strengths' },
    { key: 'weaknesses', label: 'Weaknesses', icon: TrendingDown, className: 'report-swot-weaknesses' },
    { key: 'opportunities', label: 'Opportunities', icon: Compass, className: 'report-swot-opportunities' },
    { key: 'threats', label: 'Threats', icon: AlertTriangle, className: 'report-swot-threats' },
  ]

  const renderSwot = () => (
    <>
      {result.overview && (
        <div className="report-block report-highlight">
          <SectionHeader icon={BookOpen} title={result.subject || 'SWOT Analysis'} sectionKey="overview" count={0} defaultOpen={true} />
          {isExpanded('overview', true) && <div className="report-block-content"><p>{result.overview}</p></div>}
        </div>
      )}
      <div className="report-swot-grid">
        {SWOT_QUADRANTS.map(q => {
          const items = result[q.key] || []
          const QIcon = q.icon
          return (
            <div key={q.key} className={`report-swot-quadrant ${q.className}`}>
              <div className="report-swot-quadrant-header">
                <QIcon className="w-4 h-4" />
                <span>{q.label}</span>
                <span className="report-section-count">{items.length}</span>
              </div>
              <div className="report-swot-quadrant-body">
                {items.map((item, i) => (
                  <div key={i} className="report-swot-item">
                    <strong>{item.point}</strong>
                    <p>{item.detail}</p>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
      {result.strategic_recommendations?.length > 0 && (
        <div className="report-block">
          <SectionHeader icon={Lightbulb} title="Strategic Recommendations" sectionKey="recommendations" count={result.strategic_recommendations.length} defaultOpen={true} />
          {isExpanded('recommendations', true) && (
            <div className="report-block-content">
              {result.strategic_recommendations.map((rec, i) => (
                <div key={i} className="report-strategy">
                  <div className="report-strategy-header">
                    <h4>{rec.strategy}</h4>
                    {rec.quadrants && <Badge variant="outline" className="report-quadrant-badge">{rec.quadrants}</Badge>}
                  </div>
                  <p>{rec.description}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {result.conclusion && (
        <div className="report-block report-highlight">
          <SectionHeader icon={CheckCircle} title="Conclusion" sectionKey="conclusion" count={0} defaultOpen={true} />
          {isExpanded('conclusion', true) && <div className="report-block-content"><p>{result.conclusion}</p></div>}
        </div>
      )}
    </>
  )

  const renderers = {
    thesis: renderThesis,
    development_plan: renderDevelopmentPlan,
    script: renderScript,
    executive_brief: renderExecutiveBrief,
    prd: renderPrd,
    swot: renderSwot,
  }

  const renderContent = renderers[report.report_type] || renderThesis

  return (
    <div className="report-card">
      
      {renderContent()}

      {/* References */}
      {result.references?.length > 0 && (
        <div className="report-block">
          <SectionHeader icon={BookOpen} title="References" sectionKey="references" count={result.references.length} />
          {isExpanded('references') && (
            <div className="report-block-content">
              {result.references.map((ref, i) => (
                <div key={i} className="report-reference">
                  {ref.source_id?.startsWith('http') ? (
                    <a href={ref.source_id} target="_blank" rel="noopener noreferrer" className="report-ref-link">
                      <ExternalLink className="w-3 h-3" />
                      {ref.title || ref.source_id}
                    </a>
                  ) : (
                    <span className="report-ref-title">{ref.title || ref.source_id}</span>
                  )}
                  {ref.relevance && <span className="report-ref-relevance"> — {ref.relevance}</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default ReportCard
