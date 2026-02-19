import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { billingApi } from '../../api/billing'
import { X, FileText, Table, FileType, Download, Loader2, Lock, Check, Copy } from 'lucide-react'
import { Badge } from '../ui/badge'
import { toast } from '../../hooks/use-toast'

const REPORT_FORMATS = [
  {
    id: 'md',
    name: 'Markdown',
    extension: '.md',
    description: 'Formatted text with headers',
    icon: FileText,
    iconColor: 'text-purple-400',
    mimeType: 'text/markdown',
    tier: null, // available to all
  },
  {
    id: 'csv',
    name: 'CSV',
    extension: '.csv',
    description: 'Tabular data extraction',
    icon: Table,
    iconColor: 'text-green-400',
    mimeType: 'text/csv',
    tier: 'starter',
  },
  {
    id: 'docx',
    name: 'Word Document',
    extension: '.doc',
    description: 'Word-compatible document',
    icon: FileType,
    iconColor: 'text-blue-400',
    mimeType: 'application/msword',
    tier: 'pro',
  },
]

// ---- Client-side report converters ----

function reportToMarkdown(report) {
  const result = report.result
  if (!result) return ''
  const lines = []

  lines.push(`# ${report.title || 'Report'}`)
  lines.push('')

  const type = report.report_type
  if (type === 'thesis') {
    if (result.abstract) { lines.push('## Abstract', '', result.abstract, '') }
    if (result.thesis_statement) { lines.push('## Thesis Statement', '', result.thesis_statement, '') }
    if (result.introduction) { lines.push('## Introduction', '', result.introduction, '') }
    if (result.literature_context) { lines.push('## Literature Context', '', result.literature_context, '') }
    if (result.arguments?.length > 0) {
      lines.push('## Arguments', '')
      result.arguments.forEach((arg, i) => {
        lines.push(`### ${i + 1}. ${arg.claim}`, '')
        if (arg.evidence) lines.push(`**Evidence:** ${arg.evidence}`, '')
        if (arg.analysis) lines.push(`**Analysis:** ${arg.analysis}`, '')
      })
    }
    if (result.counterarguments?.length > 0) {
      lines.push('## Counterarguments', '')
      result.counterarguments.forEach(ca => {
        lines.push(`- **${ca.point}**: ${ca.response}`)
      })
      lines.push('')
    }
    if (result.synthesis) { lines.push('## Synthesis', '', result.synthesis, '') }
    if (result.conclusion) { lines.push('## Conclusion', '', result.conclusion, '') }
  } else if (type === 'development_plan') {
    if (result.executive_summary) { lines.push('## Executive Summary', '', result.executive_summary, '') }
    if (result.objectives?.length > 0) {
      lines.push('## Objectives', '')
      result.objectives.forEach(obj => lines.push(`- ${obj}`))
      lines.push('')
    }
    if (result.current_state_analysis) { lines.push('## Current State Analysis', '', result.current_state_analysis, '') }
    if (result.phases?.length > 0) {
      lines.push('## Phases', '')
      result.phases.forEach((phase, i) => {
        lines.push(`### Phase ${i + 1}: ${phase.name}${phase.duration ? ` (${phase.duration})` : ''}`, '')
        if (phase.goals?.length > 0) {
          lines.push('**Goals:**')
          phase.goals.forEach(g => lines.push(`- ${g}`))
          lines.push('')
        }
        if (phase.tasks?.length > 0) {
          lines.push('**Tasks:**')
          phase.tasks.forEach(t => lines.push(`- [${t.priority || 'medium'}] ${t.task}`))
          lines.push('')
        }
        if (phase.deliverables?.length > 0) {
          lines.push(`**Deliverables:** ${phase.deliverables.join(', ')}`, '')
        }
      })
    }
    if (result.risk_assessment?.length > 0) {
      lines.push('## Risk Assessment', '')
      result.risk_assessment.forEach(r => {
        lines.push(`- **${r.risk}** (${r.probability} probability, ${r.impact} impact): ${r.mitigation}`)
      })
      lines.push('')
    }
    if (result.success_metrics?.length > 0) {
      lines.push('## Success Metrics', '')
      result.success_metrics.forEach(m => lines.push(`- ${m}`))
      lines.push('')
    }
    if (result.timeline_summary) { lines.push('## Timeline', '', result.timeline_summary, '') }
  } else if (type === 'script') {
    if (result.hook) { lines.push('## Hook', '', result.hook, '') }
    if (result.target_audience) { lines.push(`**Target Audience:** ${result.target_audience}`, '') }
    if (result.estimated_duration) { lines.push(`**Estimated Duration:** ${result.estimated_duration}`, '') }
    if (result.sections?.length > 0) {
      lines.push('## Sections', '')
      result.sections.forEach((sec, i) => {
        lines.push(`### ${i + 1}. ${sec.title}`, '', sec.content, '')
        if (sec.visual_notes) lines.push(`*Visual Notes: ${sec.visual_notes}*`, '')
        if (sec.transition) lines.push(`*Transition: ${sec.transition}*`, '')
      })
    }
    if (result.call_to_action) { lines.push('## Call to Action', '', result.call_to_action, '') }
    if (result.outro) { lines.push('## Outro', '', result.outro, '') }
    if (result.production_notes?.length > 0) {
      lines.push('## Production Notes', '')
      result.production_notes.forEach(n => lines.push(`- ${n}`))
      lines.push('')
    }
  } else if (type === 'executive_brief') {
    if (result.situation_overview) { lines.push('## Situation Overview', '', result.situation_overview, '') }
    if (result.key_findings?.length > 0) {
      lines.push('## Key Findings', '')
      result.key_findings.forEach(f => {
        lines.push(`### ${f.finding}`, '', f.significance, '')
      })
    }
    if (result.analysis) { lines.push('## Analysis', '', result.analysis, '') }
    if (result.options?.length > 0) {
      lines.push('## Options', '')
      result.options.forEach((opt, i) => {
        lines.push(`### Option ${i + 1}: ${opt.option}`, '')
        if (opt.pros?.length > 0) {
          lines.push('**Pros:**')
          opt.pros.forEach(p => lines.push(`- ${p}`))
        }
        if (opt.cons?.length > 0) {
          lines.push('**Cons:**')
          opt.cons.forEach(c => lines.push(`- ${c}`))
        }
        if (opt.cost) lines.push(`**Cost:** ${opt.cost}`)
        if (opt.timeline) lines.push(`**Timeline:** ${opt.timeline}`)
        lines.push('')
      })
    }
    if (result.recommendation) { lines.push('## Recommendation', '', result.recommendation, '') }
    if (result.next_steps?.length > 0) {
      lines.push('## Next Steps', '')
      result.next_steps.forEach((s, i) => lines.push(`${i + 1}. ${s}`))
      lines.push('')
    }
  } else if (type === 'prd') {
    if (result.product_name) { lines.push(`**Product:** ${result.product_name}${result.version ? ` (v${result.version})` : ''}`, '') }
    if (result.overview) { lines.push('## Overview', '', result.overview, '') }
    if (result.background_context) { lines.push('## Background & Context', '', result.background_context, '') }
    if (result.problem_statement) { lines.push('## Problem Statement', '', result.problem_statement, '') }
    if (result.goals?.length > 0) {
      lines.push('## Goals', '')
      result.goals.forEach(g => lines.push(`- ${g}`))
      lines.push('')
    }
    if (result.target_users) { lines.push('## Target Users', '', result.target_users, '') }
    if (result.user_stories?.length > 0) {
      lines.push('## User Stories', '')
      result.user_stories.forEach((s, i) => {
        lines.push(`${i + 1}. **${s.persona}**, ${s.action}, ${s.benefit}`)
      })
      lines.push('')
    }
    if (result.requirements?.functional?.length > 0) {
      lines.push('## Functional Requirements', '')
      result.requirements.functional.forEach(req => {
        lines.push(`### ${req.id}: ${req.title}`, '')
        lines.push(`**Priority:** ${(req.priority || '').replace('_', ' ')}`, '')
        if (req.description) lines.push(req.description, '')
        if (req.acceptance_criteria?.length > 0) {
          lines.push('**Acceptance Criteria:**', '')
          req.acceptance_criteria.forEach(c => {
            if (typeof c === 'object' && c.given) {
              lines.push(`> **Given** ${c.given}  `)
              lines.push(`> **When** ${c.when}  `)
              lines.push(`> **Then** ${c.then}`, '')
            } else {
              lines.push(`- [ ] ${typeof c === 'string' ? c : JSON.stringify(c)}`)
            }
          })
          lines.push('')
        }
      })
    }
    if (result.requirements?.non_functional?.length > 0) {
      lines.push('## Non-Functional Requirements', '')
      result.requirements.non_functional.forEach(req => {
        lines.push(`### ${req.id}: ${req.title}`, '')
        if (req.category) lines.push(`**Category:** ${req.category}`, '')
        if (req.description) lines.push(req.description, '')
      })
    }
    if (result.assumptions?.length > 0) {
      lines.push('## Assumptions', '')
      lines.push('| Assumption | Impact | Validation |')
      lines.push('|---|---|---|')
      result.assumptions.forEach(a => {
        lines.push(`| ${a.assumption || ''} | ${a.impact || ''} | ${a.validation || ''} |`)
      })
      lines.push('')
    }
    if (result.constraints?.length > 0) {
      lines.push('## Constraints', '')
      result.constraints.forEach(c => {
        lines.push(`- **[${c.type || 'general'}]** ${c.constraint}${c.impact ? ` — ${c.impact}` : ''}`)
      })
      lines.push('')
    }
    if (result.dependencies?.length > 0) {
      lines.push('## Dependencies', '')
      result.dependencies.forEach(d => {
        lines.push(`- **[${(d.type || '').replace('_', ' ')}]** ${d.status ? `[${d.status}]` : ''} ${d.dependency}${d.detail ? ` — ${d.detail}` : ''}`)
      })
      lines.push('')
    }
    if (result.risks?.length > 0) {
      lines.push('## Risks', '')
      result.risks.forEach(r => {
        lines.push(`### ${r.risk}`, '')
        lines.push(`**Category:** ${r.category || 'N/A'} | **Probability:** ${r.probability || 'N/A'} | **Impact:** ${r.impact || 'N/A'}`, '')
        if (r.mitigation) lines.push(`**Mitigation:** ${r.mitigation}`, '')
      })
    }
    if (result.open_questions?.length > 0) {
      lines.push('## Open Questions', '')
      result.open_questions.forEach((q, i) => {
        lines.push(`${i + 1}. **[${q.priority || 'medium'}]** ${q.question}${q.context ? ` — ${q.context}` : ''}`)
      })
      lines.push('')
    }
    if (result.release_strategy) {
      lines.push('## Release Strategy', '')
      result.release_strategy.phases?.forEach((phase, i) => {
        lines.push(`### Phase ${i + 1}: ${phase.name}`, '')
        if (phase.scope) lines.push(`**Scope:** ${phase.scope}`, '')
        if (phase.success_criteria) lines.push(`**Success Criteria:** ${phase.success_criteria}`, '')
      })
      if (result.release_strategy.feature_flags?.length > 0) {
        lines.push('**Feature Flags:**', '')
        result.release_strategy.feature_flags.forEach(f => lines.push(`- \`${f}\``))
        lines.push('')
      }
      if (result.release_strategy.rollback_plan) {
        lines.push(`**Rollback Plan:** ${result.release_strategy.rollback_plan}`, '')
      }
    }
    if (result.success_metrics?.length > 0) {
      lines.push('## Success Metrics', '')
      const isStructured = typeof result.success_metrics[0] === 'object' && result.success_metrics[0].metric
      if (isStructured) {
        lines.push('| Metric | Target | How to Measure |')
        lines.push('|---|---|---|')
        result.success_metrics.forEach(m => {
          lines.push(`| ${m.metric || ''} | ${m.target || ''} | ${m.measurement_method || ''} |`)
        })
      } else {
        result.success_metrics.forEach(m => lines.push(`- ${typeof m === 'string' ? m : JSON.stringify(m)}`))
      }
      lines.push('')
    }
    if (result.technical_considerations) { lines.push('## Technical Considerations', '', result.technical_considerations, '') }
    if (result.out_of_scope?.length > 0) {
      lines.push('## Out of Scope', '')
      result.out_of_scope.forEach(item => lines.push(`- ${item}`))
      lines.push('')
    }
    if (result.timeline) { lines.push('## Timeline', '', result.timeline, '') }
  } else if (type === 'swot') {
    if (result.subject) { lines.push(`**Subject:** ${result.subject}`, '') }
    if (result.overview) { lines.push('## Overview', '', result.overview, '') }
    const quadrants = ['strengths', 'weaknesses', 'opportunities', 'threats']
    quadrants.forEach(q => {
      if (result[q]?.length > 0) {
        lines.push(`## ${q.charAt(0).toUpperCase() + q.slice(1)}`, '')
        result[q].forEach(item => {
          lines.push(`- **${item.point}**: ${item.detail}`)
        })
        lines.push('')
      }
    })
    if (result.strategic_recommendations?.length > 0) {
      lines.push('## Strategic Recommendations', '')
      result.strategic_recommendations.forEach((rec, i) => {
        lines.push(`### ${i + 1}. ${rec.strategy}${rec.quadrants ? ` [${rec.quadrants}]` : ''}`, '')
        lines.push(rec.description, '')
      })
    }
    if (result.conclusion) { lines.push('## Conclusion', '', result.conclusion, '') }
  }

  // References
  if (result.references?.length > 0) {
    lines.push('## References', '')
    result.references.forEach((ref, i) => {
      const title = ref.title || ref.source_id || `Source ${i + 1}`
      if (ref.source_id?.startsWith('http')) {
        lines.push(`${i + 1}. [${title}](${ref.source_id})${ref.relevance ? ` — ${ref.relevance}` : ''}`)
      } else {
        lines.push(`${i + 1}. ${title}${ref.relevance ? ` — ${ref.relevance}` : ''}`)
      }
    })
    lines.push('')
  }

  return lines.join('\n')
}

function reportToCsv(report) {
  const result = report.result
  if (!result) return ''
  const rows = [['Section', 'Title', 'Content', 'Type']]

  const esc = (val) => {
    if (!val) return ''
    const s = String(val).replace(/"/g, '""')
    return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s}"` : s
  }
  const addRow = (section, title, content, type) => {
    rows.push([esc(section), esc(title), esc(content), esc(type)])
  }

  const type = report.report_type
  if (type === 'thesis') {
    if (result.abstract) addRow('Abstract', '', result.abstract, 'text')
    if (result.thesis_statement) addRow('Thesis Statement', '', result.thesis_statement, 'text')
    if (result.introduction) addRow('Introduction', '', result.introduction, 'text')
    result.arguments?.forEach(arg => addRow('Arguments', arg.claim, `Evidence: ${arg.evidence || ''}\nAnalysis: ${arg.analysis || ''}`, 'argument'))
    result.counterarguments?.forEach(ca => addRow('Counterarguments', ca.point, ca.response, 'counterargument'))
    if (result.synthesis) addRow('Synthesis', '', result.synthesis, 'text')
    if (result.conclusion) addRow('Conclusion', '', result.conclusion, 'text')
  } else if (type === 'development_plan') {
    if (result.executive_summary) addRow('Executive Summary', '', result.executive_summary, 'text')
    result.objectives?.forEach(obj => addRow('Objectives', obj, '', 'objective'))
    result.phases?.forEach((phase, i) => {
      addRow('Phases', `Phase ${i + 1}: ${phase.name}`, phase.duration || '', 'phase')
      phase.tasks?.forEach(t => addRow('Tasks', t.task, `Priority: ${t.priority || 'medium'}`, 'task'))
    })
    result.risk_assessment?.forEach(r => addRow('Risk Assessment', r.risk, `Probability: ${r.probability}, Impact: ${r.impact}, Mitigation: ${r.mitigation}`, 'risk'))
    result.success_metrics?.forEach(m => addRow('Success Metrics', m, '', 'metric'))
  } else if (type === 'script') {
    if (result.hook) addRow('Hook', '', result.hook, 'text')
    result.sections?.forEach(sec => addRow('Sections', sec.title, sec.content, 'section'))
    if (result.call_to_action) addRow('Call to Action', '', result.call_to_action, 'text')
    result.production_notes?.forEach(n => addRow('Production Notes', n, '', 'note'))
  } else if (type === 'executive_brief') {
    if (result.situation_overview) addRow('Situation Overview', '', result.situation_overview, 'text')
    result.key_findings?.forEach(f => addRow('Key Findings', f.finding, f.significance, 'finding'))
    if (result.analysis) addRow('Analysis', '', result.analysis, 'text')
    result.options?.forEach(opt => addRow('Options', opt.option, `Pros: ${(opt.pros || []).join('; ')} | Cons: ${(opt.cons || []).join('; ')}`, 'option'))
    if (result.recommendation) addRow('Recommendation', '', result.recommendation, 'text')
    result.next_steps?.forEach((s, i) => addRow('Next Steps', `Step ${i + 1}`, s, 'step'))
  } else if (type === 'prd') {
    if (result.overview) addRow('Overview', result.product_name || '', result.overview, 'text')
    if (result.background_context) addRow('Background & Context', '', result.background_context, 'text')
    if (result.problem_statement) addRow('Problem Statement', '', result.problem_statement, 'text')
    result.goals?.forEach(g => addRow('Goals', g, '', 'goal'))
    if (result.target_users) addRow('Target Users', '', result.target_users, 'text')
    result.user_stories?.forEach(s => addRow('User Stories', s.persona, `${s.action} — ${s.benefit}`, 'story'))
    result.requirements?.functional?.forEach(req => {
      const criteriaStr = (req.acceptance_criteria || []).map(c => {
        if (typeof c === 'object' && c.given) return `Given ${c.given} When ${c.when} Then ${c.then}`
        return typeof c === 'string' ? c : JSON.stringify(c)
      }).join('; ')
      addRow('Functional Requirements', `${req.id}: ${req.title}`, `Priority: ${(req.priority || '').replace('_', ' ')} | ${req.description} | Criteria: ${criteriaStr}`, 'requirement')
    })
    result.requirements?.non_functional?.forEach(req => addRow('Non-Functional Requirements', `${req.id}: ${req.title}`, `Category: ${req.category || ''} | ${req.description}`, 'requirement'))
    result.assumptions?.forEach(a => addRow('Assumptions', a.assumption, `Impact: ${a.impact || ''} | Validation: ${a.validation || ''}`, 'assumption'))
    result.constraints?.forEach(c => addRow('Constraints', c.constraint, `Type: ${c.type || ''} | Impact: ${c.impact || ''}`, 'constraint'))
    result.dependencies?.forEach(d => addRow('Dependencies', d.dependency, `Type: ${d.type || ''} | Status: ${d.status || ''} | ${d.detail || ''}`, 'dependency'))
    result.risks?.forEach(r => addRow('Risks', r.risk, `Category: ${r.category || ''} | Probability: ${r.probability || ''} | Impact: ${r.impact || ''} | Mitigation: ${r.mitigation || ''}`, 'risk'))
    result.open_questions?.forEach(q => addRow('Open Questions', q.question, `Priority: ${q.priority || ''} | ${q.context || ''}`, 'question'))
    result.release_strategy?.phases?.forEach(p => addRow('Release Strategy', p.name, `Scope: ${p.scope || ''} | Success Criteria: ${p.success_criteria || ''}`, 'phase'))
    if (result.technical_considerations) addRow('Technical Considerations', '', result.technical_considerations, 'text')
    result.success_metrics?.forEach(m => {
      if (typeof m === 'object' && m.metric) {
        addRow('Success Metrics', m.metric, `Target: ${m.target || ''} | Method: ${m.measurement_method || ''}`, 'metric')
      } else {
        addRow('Success Metrics', typeof m === 'string' ? m : JSON.stringify(m), '', 'metric')
      }
    })
    result.out_of_scope?.forEach(item => addRow('Out of Scope', item, '', 'exclusion'))
    if (result.timeline) addRow('Timeline', '', result.timeline, 'text')
  } else if (type === 'swot') {
    if (result.overview) addRow('Overview', result.subject || '', result.overview, 'text')
    result.strengths?.forEach(s => addRow('Strengths', s.point, s.detail, 'strength'))
    result.weaknesses?.forEach(w => addRow('Weaknesses', w.point, w.detail, 'weakness'))
    result.opportunities?.forEach(o => addRow('Opportunities', o.point, o.detail, 'opportunity'))
    result.threats?.forEach(t => addRow('Threats', t.point, t.detail, 'threat'))
    result.strategic_recommendations?.forEach(r => addRow('Recommendations', `${r.strategy} [${r.quadrants || ''}]`, r.description, 'recommendation'))
    if (result.conclusion) addRow('Conclusion', '', result.conclusion, 'text')
  }

  // References
  result.references?.forEach(ref => {
    addRow('References', ref.title || ref.source_id || '', ref.relevance || '', 'reference')
  })

  return rows.map(r => r.join(',')).join('\n')
}

function reportToDocx(report) {
  const md = reportToMarkdown(report)
  // Convert markdown to simple HTML for .doc compatibility
  let html = md
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
    .replace(/\*(.+?)\*/g, '<i>$1</i>')
    .replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')

  // Wrap consecutive <li> in <ul>
  html = html.replace(/((?:<li>.*<\/li>\n?)+)/g, '<ul>$1</ul>')

  // Wrap remaining plain text lines in <p>
  html = html.split('\n').map(line => {
    const trimmed = line.trim()
    if (!trimmed) return ''
    if (trimmed.startsWith('<h') || trimmed.startsWith('<ul') || trimmed.startsWith('<li') || trimmed.startsWith('<p')) return line
    return `<p>${trimmed}</p>`
  }).join('\n')

  const doc = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8"><title>${report.title || 'Report'}</title>
<style>
body { font-family: Calibri, Arial, sans-serif; color: #222; line-height: 1.6; max-width: 700px; margin: 0 auto; padding: 40px; }
h1 { font-size: 24pt; color: #1a1a2e; border-bottom: 2px solid #6366f1; padding-bottom: 8px; }
h2 { font-size: 16pt; color: #2d2d44; margin-top: 24px; }
h3 { font-size: 13pt; color: #3f3f46; }
p { margin: 8px 0; }
ul { padding-left: 20px; }
li { margin: 4px 0; }
b { color: #1a1a2e; }
a { color: #6366f1; }
</style></head>
<body>${html}</body></html>`

  return new Blob([doc], { type: 'application/msword' })
}

// ---- Component ----

function ReportExportModal({ isOpen, onClose, report }) {
  const { token } = useAuth()
  const navigate = useNavigate()
  const [selectedFormat, setSelectedFormat] = useState('md')
  const [availableFormats, setAvailableFormats] = useState(['txt', 'md'])
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!token || !isOpen) return
    setLoading(true)
    billingApi.getExportFormats(token)
      .then(formats => setAvailableFormats(formats))
      .catch(() => setAvailableFormats(['txt', 'md']))
      .finally(() => setLoading(false))
  }, [token, isOpen])

  if (!isOpen || !report) return null

  const isFormatAvailable = (fmt) => {
    if (!fmt.tier) return true
    // Map tier to what formats the user has access to
    // If user has md, they at least have free. csv requires starter+, docx requires pro+
    if (fmt.id === 'md') return true
    if (fmt.id === 'csv') return availableFormats.includes('json') || availableFormats.includes('csv') || availableFormats.length >= 3
    if (fmt.id === 'docx') return availableFormats.includes('pdf') || availableFormats.includes('obsidian') || availableFormats.length >= 4
    return false
  }

  const handleExport = () => {
    setExporting(true)
    try {
      const fmt = REPORT_FORMATS.find(f => f.id === selectedFormat)
      if (!fmt) return
      const safeTitle = (report.title || 'report').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 50)

      let blob
      if (selectedFormat === 'md') {
        const content = reportToMarkdown(report)
        blob = new Blob([content], { type: 'text/markdown' })
      } else if (selectedFormat === 'csv') {
        const content = reportToCsv(report)
        blob = new Blob([content], { type: 'text/csv' })
      } else if (selectedFormat === 'docx') {
        blob = reportToDocx(report)
      }

      if (blob) {
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${safeTitle}${fmt.extension}`
        a.click()
        URL.revokeObjectURL(url)
      }

      toast({ variant: 'success', title: 'Report exported', description: `Downloaded as ${fmt.name}` })
      onClose()
    } catch (err) {
      toast({ variant: 'destructive', title: 'Export failed', description: err.message })
    } finally {
      setExporting(false)
    }
  }

  const handleCopyMarkdown = async () => {
    try {
      const md = reportToMarkdown(report)
      await navigator.clipboard.writeText(md)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
      toast({ variant: 'success', title: 'Copied to clipboard' })
    } catch {
      toast({ variant: 'destructive', title: 'Copy failed' })
    }
  }

  const handleUpgrade = () => {
    onClose()
    navigate('/pricing')
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content report-export-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Export Report</h2>
          <button className="modal-close" onClick={onClose}>
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="modal-body">
          <p className="export-desc">
            Export "{report.title}" as a downloadable file.
          </p>

          <div className="export-formats-list">
            {REPORT_FORMATS.map((fmt) => {
              const available = isFormatAvailable(fmt)
              const isSelected = selectedFormat === fmt.id
              const Icon = fmt.icon

              return (
                <div
                  key={fmt.id}
                  className={`export-format-item ${isSelected ? 'export-format-selected' : ''} ${!available ? 'export-format-locked' : ''}`}
                  onClick={() => available && setSelectedFormat(fmt.id)}
                >
                  <div className="export-format-info">
                    <div className="export-format-name">
                      <Icon className={`w-5 h-5 ${fmt.iconColor}`} />
                      {fmt.name}
                      <span className="export-format-ext">{fmt.extension}</span>
                      {!available && fmt.tier && (
                        <Badge variant="secondary" className="ml-2">
                          <Lock className="w-3 h-3 mr-1" />
                          {fmt.tier.charAt(0).toUpperCase() + fmt.tier.slice(1)}+
                        </Badge>
                      )}
                    </div>
                    <span className="export-format-desc">{fmt.description}</span>
                  </div>
                  {isSelected && available && (
                    <div className="export-format-check">
                      <div className="w-5 h-5 rounded-full bg-purple-500 flex items-center justify-center">
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          <div className="report-export-actions">
            <button
              className="btn-primary report-export-btn"
              onClick={handleExport}
              disabled={exporting || loading}
            >
              {exporting ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Exporting...</>
              ) : (
                <><Download className="w-4 h-4" /> Download {REPORT_FORMATS.find(f => f.id === selectedFormat)?.extension}</>
              )}
            </button>
            <button className="btn-secondary report-export-btn" onClick={handleCopyMarkdown}>
              {copied ? <><Check className="w-4 h-4" /> Copied</> : <><Copy className="w-4 h-4" /> Copy Markdown</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export { reportToMarkdown }
export default ReportExportModal
