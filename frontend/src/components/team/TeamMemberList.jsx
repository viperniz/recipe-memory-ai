import React from 'react'
import { Shield, ShieldCheck, User, MoreVertical, UserMinus, ArrowUpDown } from 'lucide-react'
import { Button } from '../ui/button'

function TeamMemberList({ members, myRole, onUpdateRole, onRemoveMember, currentUserId }) {
  const canManageMembers = myRole === 'owner' || myRole === 'admin'

  const getRoleIcon = (role) => {
    switch (role) {
      case 'owner': return <ShieldCheck className="w-3.5 h-3.5" />
      case 'admin': return <Shield className="w-3.5 h-3.5" />
      default: return <User className="w-3.5 h-3.5" />
    }
  }

  return (
    <div className="team-members">
      {members.map((member) => {
        const isMe = member.user_id === currentUserId
        const initial = (member.full_name || member.email || '?')[0].toUpperCase()
        const canModify = canManageMembers && !isMe && member.role !== 'owner'
        const canChangeRole = myRole === 'owner' && member.role !== 'owner'

        return (
          <div key={member.user_id} className="team-member-row">
            <div className="team-member-avatar">{initial}</div>
            <div className="team-member-info">
              <div className="team-member-name">
                {member.full_name || member.email}
                {isMe && <span style={{ color: '#71717a', fontSize: 12, marginLeft: 6 }}>(you)</span>}
              </div>
              <div className="team-member-email">{member.email}</div>
            </div>
            <span className={`team-role-badge ${member.role}`}>
              {getRoleIcon(member.role)}
              <span style={{ marginLeft: 4 }}>{member.role}</span>
            </span>
            {canModify && (
              <div className="team-member-actions">
                {canChangeRole && (
                  <Button
                    variant="ghost"
                    size="sm"
                    title={member.role === 'admin' ? 'Demote to member' : 'Promote to admin'}
                    onClick={() => onUpdateRole(member.user_id, member.role === 'admin' ? 'member' : 'admin')}
                  >
                    <ArrowUpDown className="w-3.5 h-3.5" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  title="Remove member"
                  onClick={() => onRemoveMember(member.user_id, member.full_name || member.email)}
                >
                  <UserMinus className="w-3.5 h-3.5" />
                </Button>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

export default TeamMemberList
