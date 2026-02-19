import React, { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { reportsApi } from '../../api/reports'
import { toast } from '../../hooks/use-toast'
import { Badge } from '../ui/badge'
import ReportCard from './ReportCard'
import {
  X, Loader2, AlertTriangle, RefreshCw, Trash2, Clock,
  FileText, Code, Film, Briefcase, Copy, Check, Download
} from 'lucide-react'
import ReportExportModal from '../modals/ReportExportModal'
import { reportToMarkdown } from '../modals/ReportExportModal'

const TYPE_CONFIG = {
  thesis: { label: 'Thesis', color: '#a855f7', icon: FileText },
  development_plan: { label: 'Development Plan', color: '#3b82f6', icon: Code },
  script: { label: 'Script', color: '#f97316', icon: Film },
  executive_brief: { label: 'Executive Brief', color: '#22c55e', icon: Briefcase },
}

function ReportPanel({ reportId, report: initialReport, onClose, onDelete }) {
  const { token } = useAuth()
  const [report, setReport] = useState(initialReport || null)
  const [isLoading, setIsLoading] = useState(!initialReport)
  const [copied, setCopied] = useState(false)
  const [showExportModal, setShowExportModal] = useState(false)

  useEffect(() => {
    if (!reportId || !token || initialReport?.result) return
    loadReport()
  }, [reportId, token])

  // Poll while generating
  useEffect(() => {
    if (!report || report.status !== 'generating') return
    const interval = setInterval(async () => {
      try {
        const data = await reportsApi.getReport(token, report.id)
        setReport(data)
        if (data.status !== 'generating') clearInterval(interval)
      } catch {}
    }, 5000)
    return () => clearInterval(interval)
  }, [report?.id, report?.status, token])

  const loadReport = async () => {
    setIsLoading(true)
    try {
      const data = await reportsApi.getReport(token, reportId)
      setReport(data)
    } catch (err) {
      toast({ variant: 'destructive', title: 'Failed to load report' })
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('Delete this report?')) return
    try {
      await reportsApi.deleteReport(token, report.id)
      toast({ title: 'Report deleted' })
      if (onDelete) onDelete(report.id)
      if (onClose) onClose()
    } catch {
      toast({ variant: 'destructive', title: 'Failed to delete report' })
    }
  }

  const handleCopyMarkdown = () => {
    if (!report?.result) return
    const md = reportToMarkdown(report)
    navigator.clipboard.writeText(md).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  if (isLoading) {
    return (
      <div className="report-panel report-panel-loading">
        <Loader2 className="w-6 h-6 animate-spin" />
        <span>Loading report...</span>
      </div>
    )
  }

  if (!report) return null

  const typeConfig = TYPE_CONFIG[report.report_type] || TYPE_CONFIG.thesis
  const TypeIcon = typeConfig.icon

  return (
    <div className="report-panel">
      <div className="report-panel-header">
        <div className="report-panel-title-row">
          <Badge
            style={{ background: `${typeConfig.color}20`, color: typeConfig.color, borderColor: `${typeConfig.color}40` }}
          >
            <TypeIcon className="w-3 h-3 mr-1" />
            {typeConfig.label}
          </Badge>
          <h2 className="report-panel-title">{report.title}</h2>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '6px' }}>
            {report.created_at && <span className="report-panel-date"><Clock className="w-3 h-3" />{new Date(report.created_at).toLocaleDateString()}</span>}
            {report.content_ids?.length > 0 && <span className="report-panel-sources">{report.content_ids.length} source{report.content_ids.length !== 1 ? 's' : ''}</span>}
            {report.credits_charged && <span className="report-panel-credits">{report.credits_charged} credits</span>}
            {report.status === 'completed' && (
              <>
                <button className="btn-icon-sm" onClick={() => setShowExportModal(true)} title="Export report"><Download className="w-4 h-4" /></button>
                <button className="btn-icon-sm" onClick={handleCopyMarkdown} title="Copy as Markdown">{copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}</button>
              </>
            )}
            <button className="btn-icon-sm btn-danger-sm" onClick={handleDelete} title="Delete report"><Trash2 className="w-4 h-4" /></button>
            {onClose && <button className="btn-icon-sm" onClick={onClose} title="Close"><X className="w-4 h-4" /></button>}
          </div>
        </div>
      </div>

      <div className="report-panel-body">
        {report.status === 'generating' && (
          <div className="report-status-banner report-status-generating">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Generating report... This may take a minute.</span>
          </div>
        )}
        {report.status === 'failed' && (
          <div className="report-status-banner report-status-failed">
            <AlertTriangle className="w-5 h-5" />
            <span>{report.error || 'Report generation failed'}</span>
            <button className="btn-sm" onClick={loadReport}>
              <RefreshCw className="w-3 h-3" /> Retry
            </button>
          </div>
        )}
        {report.status === 'completed' && report.result && (
          <ReportCard report={report} />
        )}
      </div>
      <ReportExportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        report={report}
      />
    </div>
  )
}

export default ReportPanel
