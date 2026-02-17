import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { teamApi } from '../api/team'
import { toast } from '../hooks/use-toast'
import { Users, Plus, ArrowLeft, Share2, Settings, Trash2, Loader2 } from 'lucide-react'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import AppNavbar from '../components/layout/AppNavbar'
import TeamMemberList from '../components/team/TeamMemberList'
import InviteMemberModal from '../components/team/InviteMemberModal'
import ShareContentModal from '../components/team/ShareContentModal'
import InvitationBanner from '../components/team/InvitationBanner'

function TeamPage() {
  const { user, token, logout } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const [teams, setTeams] = useState([])
  const [selectedTeam, setSelectedTeam] = useState(null)
  const [invitations, setInvitations] = useState([])
  const [sharedContent, setSharedContent] = useState([])
  const [isLoading, setIsLoading] = useState(true)

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [showShareModal, setShowShareModal] = useState(false)
  const [isInviting, setIsInviting] = useState(false)
  const [isSharing, setIsSharing] = useState(false)

  // Create team form
  const [newTeamName, setNewTeamName] = useState('')
  const [newTeamDesc, setNewTeamDesc] = useState('')

  useEffect(() => {
    document.title = 'Team — Second Mind'
  }, [])

  const loadTeams = useCallback(async () => {
    if (!token) return
    try {
      const data = await teamApi.getTeams(token)
      setTeams(data.teams || [])
    } catch (err) {
      console.error('Failed to load teams:', err)
    }
  }, [token])

  const loadInvitations = useCallback(async () => {
    if (!token) return
    try {
      const data = await teamApi.getInvitations(token)
      setInvitations(data.invitations || [])
    } catch (err) {
      console.error('Failed to load invitations:', err)
    }
  }, [token])

  const loadTeamDetails = useCallback(async (teamId) => {
    if (!token) return
    try {
      const data = await teamApi.getTeam(token, teamId)
      setSelectedTeam(data.team)

      const contentData = await teamApi.getTeamContent(token, teamId)
      setSharedContent(contentData.content || [])
    } catch (err) {
      console.error('Failed to load team details:', err)
      toast({ variant: 'destructive', title: 'Failed to load team', description: err.response?.data?.detail || err.message })
    }
  }, [token])

  useEffect(() => {
    const init = async () => {
      setIsLoading(true)
      await Promise.all([loadTeams(), loadInvitations()])
      setIsLoading(false)
    }
    init()
  }, [loadTeams, loadInvitations])

  // Handle invite query param
  useEffect(() => {
    const inviteToken = searchParams.get('invite')
    if (inviteToken && token) {
      handleAcceptInvitation(inviteToken)
    }
  }, [searchParams, token])

  const handleCreateTeam = async () => {
    if (!newTeamName.trim()) return
    try {
      const data = await teamApi.createTeam(token, newTeamName, newTeamDesc)
      toast({ variant: 'success', title: 'Team created', description: data.team.name })
      setNewTeamName('')
      setNewTeamDesc('')
      setShowCreateModal(false)
      loadTeams()
    } catch (err) {
      const detail = err.response?.data?.detail
      if (detail?.error === 'feature_locked') {
        toast({
          variant: 'destructive',
          title: 'Feature Locked',
          description: detail.message || 'Team workspaces require the Department plan.'
        })
      } else {
        toast({
          variant: 'destructive',
          title: 'Failed to create team',
          description: typeof detail === 'string' ? detail : err.message
        })
      }
    }
  }

  const handleDeleteTeam = async (teamId) => {
    if (!window.confirm('Are you sure you want to delete this team? This cannot be undone.')) return
    try {
      await teamApi.deleteTeam(token, teamId)
      toast({ variant: 'success', title: 'Team deleted' })
      setSelectedTeam(null)
      loadTeams()
    } catch (err) {
      toast({ variant: 'destructive', title: 'Failed to delete team', description: err.response?.data?.detail || err.message })
    }
  }

  const handleInvite = async (email, role) => {
    if (!selectedTeam) return
    setIsInviting(true)
    try {
      await teamApi.inviteMember(token, selectedTeam.id, email, role)
      toast({ variant: 'success', title: 'Invitation sent', description: `Invited ${email}` })
      setShowInviteModal(false)
      loadTeamDetails(selectedTeam.id)
    } catch (err) {
      toast({ variant: 'destructive', title: 'Failed to invite', description: err.response?.data?.detail || err.message })
    } finally {
      setIsInviting(false)
    }
  }

  const handleAcceptInvitation = async (inviteToken) => {
    try {
      const result = await teamApi.acceptInvitation(token, inviteToken)
      toast({ variant: 'success', title: 'Invitation accepted', description: `Joined ${result.team_name || 'team'}` })
      loadTeams()
      loadInvitations()
    } catch (err) {
      toast({ variant: 'destructive', title: 'Failed to accept invite', description: err.response?.data?.detail || err.message })
    }
  }

  const handleDeclineInvitation = async (inviteToken) => {
    try {
      await teamApi.declineInvitation(token, inviteToken)
      toast({ variant: 'default', title: 'Invitation declined' })
      loadInvitations()
    } catch (err) {
      toast({ variant: 'destructive', title: 'Failed to decline', description: err.response?.data?.detail || err.message })
    }
  }

  const handleUpdateRole = async (userId, newRole) => {
    if (!selectedTeam) return
    try {
      await teamApi.updateMemberRole(token, selectedTeam.id, userId, newRole)
      toast({ variant: 'success', title: 'Role updated' })
      loadTeamDetails(selectedTeam.id)
    } catch (err) {
      toast({ variant: 'destructive', title: 'Failed to update role', description: err.response?.data?.detail || err.message })
    }
  }

  const handleRemoveMember = async (userId, name) => {
    if (!window.confirm(`Remove ${name} from the team?`)) return
    if (!selectedTeam) return
    try {
      await teamApi.removeMember(token, selectedTeam.id, userId)
      toast({ variant: 'success', title: 'Member removed' })
      loadTeamDetails(selectedTeam.id)
    } catch (err) {
      toast({ variant: 'destructive', title: 'Failed to remove member', description: err.response?.data?.detail || err.message })
    }
  }

  const handleShareContent = async (teamId, contentId) => {
    setIsSharing(true)
    try {
      await teamApi.shareContent(token, teamId, contentId)
      toast({ variant: 'success', title: 'Content shared with team' })
      setShowShareModal(false)
      if (selectedTeam) loadTeamDetails(selectedTeam.id)
    } catch (err) {
      toast({ variant: 'destructive', title: 'Failed to share', description: err.response?.data?.detail || err.message })
    } finally {
      setIsSharing(false)
    }
  }

  const handleUnshareContent = async (contentId) => {
    if (!selectedTeam) return
    try {
      await teamApi.unshareContent(token, selectedTeam.id, contentId)
      toast({ variant: 'success', title: 'Content unshared' })
      loadTeamDetails(selectedTeam.id)
    } catch (err) {
      toast({ variant: 'destructive', title: 'Failed to unshare', description: err.response?.data?.detail || err.message })
    }
  }

  const handleLogout = async () => {
    await logout()
    navigate('/')
  }

  // Team detail view
  if (selectedTeam) {
    const canManage = selectedTeam.my_role === 'owner' || selectedTeam.my_role === 'admin'
    const isOwner = selectedTeam.my_role === 'owner'

    return (
      <div className="app-layout">
        <AppNavbar user={user} onLogout={handleLogout} />
        <div className="app-body">
          <main id="main-content" className="main-content">
            <div className="team-page">
              <Button variant="ghost" onClick={() => setSelectedTeam(null)} style={{ marginBottom: 16 }}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                All teams
              </Button>

              <div className="team-header">
                <div className="team-header-info">
                  <h2>{selectedTeam.name}</h2>
                  {selectedTeam.description && <p>{selectedTeam.description}</p>}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {canManage && (
                    <Button variant="outline" size="sm" onClick={() => setShowInviteModal(true)}>
                      <Plus className="w-4 h-4 mr-1" />
                      Invite
                    </Button>
                  )}
                  <Button variant="outline" size="sm" onClick={() => setShowShareModal(true)}>
                    <Share2 className="w-4 h-4 mr-1" />
                    Share Content
                  </Button>
                  {isOwner && (
                    <Button variant="ghost" size="sm" onClick={() => handleDeleteTeam(selectedTeam.id)} title="Delete team">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>

              {/* Members section */}
              <div className="team-section">
                <div className="team-section-header">
                  <span className="team-section-title">
                    Members ({selectedTeam.members?.length || 0} / {selectedTeam.max_members})
                  </span>
                </div>
                <TeamMemberList
                  members={selectedTeam.members || []}
                  myRole={selectedTeam.my_role}
                  currentUserId={user?.id}
                  onUpdateRole={handleUpdateRole}
                  onRemoveMember={handleRemoveMember}
                />
              </div>

              {/* Shared content section */}
              <div className="team-section">
                <div className="team-section-header">
                  <span className="team-section-title">Shared Content ({sharedContent.length})</span>
                </div>
                {sharedContent.length === 0 ? (
                  <div className="team-empty" style={{ padding: 24 }}>
                    <p style={{ color: '#71717a', fontSize: 13 }}>
                      No content shared yet. Share something from your library!
                    </p>
                  </div>
                ) : (
                  <div className="team-members">
                    {sharedContent.map(item => (
                      <div key={item.id} className="team-member-row" style={{ cursor: 'default' }}>
                        <div className="team-member-info">
                          <div className="team-member-name">{item.title || 'Untitled'}</div>
                          <div className="team-member-email">
                            {item.content_type || 'video'} &middot; Shared by {item.shared_by?.name}
                          </div>
                        </div>
                        {(canManage || item.shared_by?.user_id === user?.id) && (
                          <Button variant="ghost" size="sm" onClick={() => handleUnshareContent(item.id)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <InviteMemberModal
              isOpen={showInviteModal}
              onClose={() => setShowInviteModal(false)}
              onInvite={handleInvite}
              isInviting={isInviting}
            />

            <ShareContentModal
              isOpen={showShareModal}
              onClose={() => setShowShareModal(false)}
              teams={teams}
              onShare={handleShareContent}
              isSharing={isSharing}
            />
          </main>
        </div>
      </div>
    )
  }

  // Team list view
  return (
    <div className="app-layout">
      <AppNavbar user={user} onLogout={handleLogout} />
      <div className="app-body">
        <main id="main-content" className="main-content">
          <div className="team-page">
            <h1>Team Workspaces</h1>
            <p className="team-page-subtitle">Collaborate with your team on shared research and content.</p>

            {/* Pending invitations */}
            <InvitationBanner
              invitations={invitations}
              onAccept={handleAcceptInvitation}
              onDecline={handleDeclineInvitation}
            />

            {isLoading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
                <Loader2 className="w-6 h-6 animate-spin" style={{ color: '#71717a' }} />
              </div>
            ) : teams.length === 0 ? (
              <div className="team-empty">
                <div className="team-empty-icon">
                  <Users className="w-8 h-8" />
                </div>
                <h3>No teams yet</h3>
                <p>Create a team to start collaborating with others.</p>
                <Button onClick={() => setShowCreateModal(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Team
                </Button>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
                  <Button onClick={() => setShowCreateModal(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Create Team
                  </Button>
                </div>
                <div className="team-list">
                  {teams.map(team => (
                    <div
                      key={team.id}
                      className="team-card"
                      onClick={() => loadTeamDetails(team.id)}
                    >
                      <div className="team-card-info">
                        <div className="team-card-icon">
                          <Users className="w-5 h-5" />
                        </div>
                        <div className="team-card-details">
                          <h3>{team.name}</h3>
                          <p>{team.description || 'No description'}</p>
                        </div>
                      </div>
                      <div className="team-card-meta">
                        <span>{team.member_count} member{team.member_count !== 1 ? 's' : ''}</span>
                        <span>&middot;</span>
                        <span>{team.content_count} shared</span>
                        <span className={`team-role-badge ${team.my_role}`}>{team.my_role}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Create team modal */}
          {showCreateModal && (
            <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
              <div className="modal-content" style={{ maxWidth: 460 }} onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                  <h2>Create Team</h2>
                  <button className="modal-close" onClick={() => setShowCreateModal(false)}>
                    <span className="w-5 h-5">&times;</span>
                  </button>
                </div>
                <div className="modal-body">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <Input
                      placeholder="Team name"
                      value={newTeamName}
                      onChange={(e) => setNewTeamName(e.target.value)}
                      autoFocus
                    />
                    <Input
                      placeholder="Description (optional)"
                      value={newTeamDesc}
                      onChange={(e) => setNewTeamDesc(e.target.value)}
                    />
                    <Button onClick={handleCreateTeam} disabled={!newTeamName.trim()}>
                      <Users className="w-4 h-4 mr-2" />
                      Create Team
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}

export default TeamPage
