import React from 'react'
import { Mail, Check, X } from 'lucide-react'
import { Button } from '../ui/button'

function InvitationBanner({ invitations, onAccept, onDecline }) {
  if (!invitations || invitations.length === 0) return null

  return (
    <div>
      {invitations.map(inv => (
        <div key={inv.id} className="invitation-banner">
          <Mail className="w-5 h-5" style={{ color: '#c4b5fd', flexShrink: 0 }} />
          <div className="invitation-banner-text">
            <strong>Team invitation: {inv.team_name}</strong>
            <span>Invited by {inv.invited_by_name} as {inv.role}</span>
          </div>
          <div className="invitation-banner-actions">
            <Button size="sm" onClick={() => onAccept(inv.token)}>
              <Check className="w-3.5 h-3.5 mr-1" />
              Accept
            </Button>
            <Button size="sm" variant="ghost" onClick={() => onDecline(inv.token)}>
              <X className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  )
}

export default InvitationBanner
