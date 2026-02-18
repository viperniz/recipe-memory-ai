import React from 'react'

export default function ConfirmModal({
  isOpen,
  title = 'Are you sure?',
  message,
  confirmText = 'Delete',
  cancelText = 'Cancel',
  variant = 'danger',
  onConfirm,
  onCancel,
}) {
  if (!isOpen) return null

  const colors = {
    danger:  { bg: '#ef4444', hover: '#dc2626', iconBg: 'rgba(239,68,68,0.15)', iconColor: '#ef4444' },
    warning: { bg: '#f59e0b', hover: '#d97706', iconBg: 'rgba(245,158,11,0.15)', iconColor: '#f59e0b' },
    info:    { bg: '#6d28d9', hover: '#5b21b6', iconBg: 'rgba(109,40,217,0.15)', iconColor: '#6d28d9' },
  }
  const c = colors[variant] || colors.danger

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)',
      }}
      onClick={onCancel}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#1a1628', border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '16px', padding: '28px 32px', maxWidth: '420px', width: '90%',
          boxShadow: '0 24px 60px rgba(0,0,0,0.5)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '14px' }}>
          <div style={{
            width: 42, height: 42, borderRadius: '50%', background: c.iconBg,
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke={c.iconColor} strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
            </svg>
          </div>
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#f1f5f9' }}>
            {title}
          </h2>
        </div>

        {message && (
          <p style={{ margin: '0 0 24px 52px', fontSize: '14px', color: '#94a3b8', lineHeight: '1.6' }}>
            {message}
          </p>
        )}

        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: message ? 0 : '24px' }}>
          <button
            onClick={onCancel}
            style={{
              padding: '9px 22px', borderRadius: '8px',
              border: '1px solid rgba(255,255,255,0.12)', background: 'transparent',
              color: '#94a3b8', fontSize: '14px', fontWeight: 500, cursor: 'pointer',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = '#f1f5f9' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#94a3b8' }}
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            style={{
              padding: '9px 22px', borderRadius: '8px', border: 'none',
              background: c.bg, color: '#fff', fontSize: '14px', fontWeight: 600, cursor: 'pointer',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = c.hover }}
            onMouseLeave={(e) => { e.currentTarget.style.background = c.bg }}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}
