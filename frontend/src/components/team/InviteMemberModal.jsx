import React, { useState } from 'react'
import { X, Mail, Loader2 } from 'lucide-react'
import { Button } from '../ui/button'
import { Input } from '../ui/input'

function InviteMemberModal({ isOpen, onClose, onInvite, isInviting }) {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('member')

  if (!isOpen) return null

  const handleSubmit = (e) => {
    e.preventDefault()
    if (email.trim()) {
      onInvite(email.trim(), role)
      setEmail('')
      setRole('member')
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: 460 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Invite Team Member</h2>
          <button className="modal-close" onClick={onClose}>
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="modal-body">
          <form className="invite-form" onSubmit={handleSubmit}>
            <div className="invite-form-row">
              <Input
                type="email"
                placeholder="colleague@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
              />
              <select
                className="invite-role-select"
                value={role}
                onChange={(e) => setRole(e.target.value)}
              >
                <option value="member">Member</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <p style={{ color: '#71717a', fontSize: 12, margin: '0 0 8px' }}>
              {role === 'admin'
                ? 'Admins can invite members and manage shared content.'
                : 'Members can view and share content with the team.'}
            </p>
            <Button type="submit" disabled={isInviting || !email.trim()} className="w-full">
              {isInviting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Sending invite...
                </>
              ) : (
                <>
                  <Mail className="w-4 h-4 mr-2" />
                  Send Invitation
                </>
              )}
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}

export default InviteMemberModal
