import React, { useState } from 'react'
import { Badge } from '../ui/badge'
import {
  ChevronDown, ChevronRight, FileText, Code, Film, Briefcase,
  Target, BookOpen, AlertTriangle, CheckCircle, Clock, Users,
  Lightbulb, Shield, Layers, List, ExternalLink
} from 'lucide-react'

const REPORT_TYPE_CONFIG = {
  thesis: { label: 'Thesis', color: '#a855f7', icon: FileText },
  development_plan: { label: 'Development Plan', hcolor: '#3b82f6', icon: Code },
  script: { label: 'Script', color: '#f97316', icon: Film },
  executive_brief: { label: 'Executive Brief', color: '#22c55e', icon: Briefcase },
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

  const renderers = {
    thesis: renderThesis,
    development_plan: renderDevelopmentPlan,
    script: renderScript,
    executive_brief: renderExecutiveBrief,
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
