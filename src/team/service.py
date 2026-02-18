"""
Team Workspace Service
Handles team creation, member management, invitations, and shared content.
"""

import uuid
import logging
from datetime import datetime, timedelta
from typing import Optional, List

from sqlalchemy.orm import Session
from sqlalchemy import and_

from database import (
    Team, TeamMember, TeamInvitation, TeamContent,
    User, ContentVector, Subscription,
    TIER_LIMITS
)

logger = logging.getLogger(__name__)

TIER_ORDER = ["free", "starter", "pro", "team"]


class TeamService:
    """Service for team workspace operations."""

    # =========================================
    # Team CRUD
    # =========================================

    @staticmethod
    def create_team(db: Session, user_id: int, name: str, description: str = None) -> Team:
        """Create a new team. Only team-tier users can create teams."""
        # Check tier
        sub = db.query(Subscription).filter(Subscription.user_id == user_id).first()
        tier = sub.tier if sub else "free"

        if tier != "team":
            raise PermissionError("feature_locked", "team_workspaces", "team", tier)

        # Check if user already owns a team
        existing = db.query(Team).filter(Team.owner_id == user_id).first()
        if existing:
            raise ValueError("You already own a team. Each account can own one team.")

        team = Team(
            id=str(uuid.uuid4()),
            name=name,
            description=description,
            owner_id=user_id,
            max_members=TIER_LIMITS.get(tier, {}).get("team_members", 10)
        )
        db.add(team)

        # Add owner as a member with role=owner
        member = TeamMember(
            team_id=team.id,
            user_id=user_id,
            role="owner"
        )
        db.add(member)
        db.commit()
        db.refresh(team)
        return team

    @staticmethod
    def get_user_teams(db: Session, user_id: int) -> List[dict]:
        """Get all teams a user belongs to."""
        memberships = db.query(TeamMember).filter(TeamMember.user_id == user_id).all()
        teams = []
        for m in memberships:
            team = db.query(Team).filter(Team.id == m.team_id).first()
            if team:
                member_count = db.query(TeamMember).filter(TeamMember.team_id == team.id).count()
                content_count = db.query(TeamContent).filter(TeamContent.team_id == team.id).count()
                teams.append({
                    "id": team.id,
                    "name": team.name,
                    "description": team.description,
                    "owner_id": team.owner_id,
                    "max_members": team.max_members,
                    "member_count": member_count,
                    "content_count": content_count,
                    "my_role": m.role,
                    "created_at": team.created_at.isoformat() if team.created_at else None,
                })
        return teams

    @staticmethod
    def get_team(db: Session, team_id: str, user_id: int) -> dict:
        """Get team details (must be a member)."""
        team = db.query(Team).filter(Team.id == team_id).first()
        if not team:
            raise ValueError("Team not found")

        membership = db.query(TeamMember).filter(
            and_(TeamMember.team_id == team_id, TeamMember.user_id == user_id)
        ).first()
        if not membership:
            raise PermissionError("access_denied", "You are not a member of this team")

        members = db.query(TeamMember).filter(TeamMember.team_id == team_id).all()
        member_list = []
        for m in members:
            user = db.query(User).filter(User.id == m.user_id).first()
            member_list.append({
                "user_id": m.user_id,
                "email": user.email if user else None,
                "full_name": user.full_name if user else None,
                "role": m.role,
                "joined_at": m.joined_at.isoformat() if m.joined_at else None,
            })

        content_count = db.query(TeamContent).filter(TeamContent.team_id == team_id).count()

        return {
            "id": team.id,
            "name": team.name,
            "description": team.description,
            "owner_id": team.owner_id,
            "max_members": team.max_members,
            "members": member_list,
            "member_count": len(member_list),
            "content_count": content_count,
            "my_role": membership.role,
            "created_at": team.created_at.isoformat() if team.created_at else None,
        }

    @staticmethod
    def update_team(db: Session, team_id: str, user_id: int, name: str = None, description: str = None) -> dict:
        """Update team name/description (owner or admin only)."""
        team = db.query(Team).filter(Team.id == team_id).first()
        if not team:
            raise ValueError("Team not found")

        membership = db.query(TeamMember).filter(
            and_(TeamMember.team_id == team_id, TeamMember.user_id == user_id)
        ).first()
        if not membership or membership.role not in ("owner", "admin"):
            raise PermissionError("access_denied", "Only owner or admin can update team")

        if name is not None:
            team.name = name
        if description is not None:
            team.description = description
        team.updated_at = datetime.utcnow()
        db.commit()
        return {"id": team.id, "name": team.name, "description": team.description}

    @staticmethod
    def delete_team(db: Session, team_id: str, user_id: int):
        """Delete team (owner only). Cascades everything."""
        team = db.query(Team).filter(Team.id == team_id).first()
        if not team:
            raise ValueError("Team not found")

        if team.owner_id != user_id:
            raise PermissionError("access_denied", "Only the owner can delete the team")

        db.delete(team)
        db.commit()

    # =========================================
    # Invitations
    # =========================================

    @staticmethod
    def invite_member(db: Session, team_id: str, user_id: int, email: str, role: str = "member") -> TeamInvitation:
        """Invite a user by email. Owner or admin only."""
        team = db.query(Team).filter(Team.id == team_id).first()
        if not team:
            raise ValueError("Team not found")

        # Check inviter is owner or admin
        membership = db.query(TeamMember).filter(
            and_(TeamMember.team_id == team_id, TeamMember.user_id == user_id)
        ).first()
        if not membership or membership.role not in ("owner", "admin"):
            raise PermissionError("access_denied", "Only owner or admin can invite members")

        # Check member limit
        current_count = db.query(TeamMember).filter(TeamMember.team_id == team_id).count()
        pending_count = db.query(TeamInvitation).filter(
            and_(TeamInvitation.team_id == team_id, TeamInvitation.status == "pending")
        ).count()
        if current_count + pending_count >= team.max_members:
            raise ValueError(f"Team member limit reached ({team.max_members} max)")

        # Check if already a member
        existing_user = db.query(User).filter(User.email == email).first()
        if existing_user:
            existing_member = db.query(TeamMember).filter(
                and_(TeamMember.team_id == team_id, TeamMember.user_id == existing_user.id)
            ).first()
            if existing_member:
                raise ValueError("This user is already a member of the team")

        # Check for pending invitation
        existing_invite = db.query(TeamInvitation).filter(
            and_(
                TeamInvitation.team_id == team_id,
                TeamInvitation.email == email,
                TeamInvitation.status == "pending"
            )
        ).first()
        if existing_invite:
            raise ValueError("An invitation has already been sent to this email")

        # Validate role
        if role not in ("member", "admin"):
            role = "member"

        invite = TeamInvitation(
            id=str(uuid.uuid4()),
            team_id=team_id,
            email=email,
            invited_by=user_id,
            role=role,
            token=str(uuid.uuid4()),
            expires_at=datetime.utcnow() + timedelta(days=7)
        )
        db.add(invite)
        db.commit()
        db.refresh(invite)

        # Create in-app notification for the invitee (if they have an account)
        existing_user = db.query(User).filter(User.email == email).first()
        if existing_user:
            try:
                from notification_service import create_notification
                inviter = db.query(User).filter(User.id == user_id).first()
                inviter_name = inviter.full_name if inviter else "Someone"
                create_notification(
                    db, existing_user.id, "team_invite",
                    "Team invitation",
                    f"{inviter_name} invited you to join {team.name}",
                    link=f"/app?invite={invite.token}",
                )
            except Exception:
                pass  # Non-critical

        return invite

    @staticmethod
    def get_user_invitations(db: Session, user_id: int) -> List[dict]:
        """Get pending invitations for a user."""
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            return []

        invites = db.query(TeamInvitation).filter(
            and_(
                TeamInvitation.email == user.email,
                TeamInvitation.status == "pending",
                TeamInvitation.expires_at > datetime.utcnow()
            )
        ).all()

        result = []
        for inv in invites:
            team = db.query(Team).filter(Team.id == inv.team_id).first()
            inviter = db.query(User).filter(User.id == inv.invited_by).first()
            result.append({
                "id": inv.id,
                "token": inv.token,
                "team_name": team.name if team else "Unknown",
                "team_id": inv.team_id,
                "invited_by_name": inviter.full_name or inviter.email if inviter else "Unknown",
                "role": inv.role,
                "created_at": inv.created_at.isoformat() if inv.created_at else None,
                "expires_at": inv.expires_at.isoformat() if inv.expires_at else None,
            })
        return result

    @staticmethod
    def accept_invitation(db: Session, token: str, user_id: int) -> dict:
        """Accept a team invitation."""
        invite = db.query(TeamInvitation).filter(
            and_(TeamInvitation.token == token, TeamInvitation.status == "pending")
        ).first()
        if not invite:
            raise ValueError("Invitation not found or already used")

        if invite.expires_at < datetime.utcnow():
            invite.status = "expired"
            db.commit()
            raise ValueError("Invitation has expired")

        # Verify email matches
        user = db.query(User).filter(User.id == user_id).first()
        if not user or user.email != invite.email:
            raise PermissionError("access_denied", "This invitation was sent to a different email address")

        # Check if already a member
        existing = db.query(TeamMember).filter(
            and_(TeamMember.team_id == invite.team_id, TeamMember.user_id == user_id)
        ).first()
        if existing:
            invite.status = "accepted"
            db.commit()
            return {"team_id": invite.team_id, "message": "Already a member"}

        # Add as member
        member = TeamMember(
            team_id=invite.team_id,
            user_id=user_id,
            role=invite.role
        )
        db.add(member)
        invite.status = "accepted"
        db.commit()

        team = db.query(Team).filter(Team.id == invite.team_id).first()
        return {"team_id": invite.team_id, "team_name": team.name if team else "Unknown"}

    @staticmethod
    def decline_invitation(db: Session, token: str, user_id: int):
        """Decline a team invitation."""
        invite = db.query(TeamInvitation).filter(
            and_(TeamInvitation.token == token, TeamInvitation.status == "pending")
        ).first()
        if not invite:
            raise ValueError("Invitation not found or already used")

        user = db.query(User).filter(User.id == user_id).first()
        if not user or user.email != invite.email:
            raise PermissionError("access_denied", "This invitation was sent to a different email address")

        invite.status = "declined"
        db.commit()

    # =========================================
    # Member Management
    # =========================================

    @staticmethod
    def get_members(db: Session, team_id: str, user_id: int) -> List[dict]:
        """List team members."""
        # Verify membership
        membership = db.query(TeamMember).filter(
            and_(TeamMember.team_id == team_id, TeamMember.user_id == user_id)
        ).first()
        if not membership:
            raise PermissionError("access_denied", "You are not a member of this team")

        members = db.query(TeamMember).filter(TeamMember.team_id == team_id).all()
        result = []
        for m in members:
            user = db.query(User).filter(User.id == m.user_id).first()
            result.append({
                "user_id": m.user_id,
                "email": user.email if user else None,
                "full_name": user.full_name if user else None,
                "role": m.role,
                "joined_at": m.joined_at.isoformat() if m.joined_at else None,
            })
        return result

    @staticmethod
    def update_member_role(db: Session, team_id: str, user_id: int, target_user_id: int, new_role: str):
        """Update a member's role. Owner or admin only. Admin can't change other admins."""
        membership = db.query(TeamMember).filter(
            and_(TeamMember.team_id == team_id, TeamMember.user_id == user_id)
        ).first()
        if not membership or membership.role not in ("owner", "admin"):
            raise PermissionError("access_denied", "Only owner or admin can change roles")

        target = db.query(TeamMember).filter(
            and_(TeamMember.team_id == team_id, TeamMember.user_id == target_user_id)
        ).first()
        if not target:
            raise ValueError("Member not found")

        # Owner protection
        if target.role == "owner":
            raise ValueError("Cannot change the owner's role")

        # Admin can't promote/demote other admins
        if membership.role == "admin" and target.role == "admin":
            raise PermissionError("access_denied", "Admins cannot modify other admins")

        if new_role not in ("admin", "member"):
            raise ValueError("Invalid role. Must be 'admin' or 'member'")

        target.role = new_role
        db.commit()

    @staticmethod
    def remove_member(db: Session, team_id: str, user_id: int, target_user_id: int):
        """Remove a member. Owner/admin only. Admin can't remove other admins."""
        team = db.query(Team).filter(Team.id == team_id).first()
        if not team:
            raise ValueError("Team not found")

        # Can't remove the owner
        if target_user_id == team.owner_id:
            raise ValueError("Cannot remove the team owner")

        # Allow self-removal (leave team)
        if user_id == target_user_id:
            member = db.query(TeamMember).filter(
                and_(TeamMember.team_id == team_id, TeamMember.user_id == user_id)
            ).first()
            if member:
                db.delete(member)
                db.commit()
            return

        membership = db.query(TeamMember).filter(
            and_(TeamMember.team_id == team_id, TeamMember.user_id == user_id)
        ).first()
        if not membership or membership.role not in ("owner", "admin"):
            raise PermissionError("access_denied", "Only owner or admin can remove members")

        target = db.query(TeamMember).filter(
            and_(TeamMember.team_id == team_id, TeamMember.user_id == target_user_id)
        ).first()
        if not target:
            raise ValueError("Member not found")

        # Admin can't remove other admins
        if membership.role == "admin" and target.role == "admin":
            raise PermissionError("access_denied", "Admins cannot remove other admins")

        db.delete(target)
        db.commit()

    # =========================================
    # Shared Content
    # =========================================

    @staticmethod
    def share_content(db: Session, team_id: str, user_id: int, content_id: str) -> dict:
        """Share content to a team. Any member can share."""
        membership = db.query(TeamMember).filter(
            and_(TeamMember.team_id == team_id, TeamMember.user_id == user_id)
        ).first()
        if not membership:
            raise PermissionError("access_denied", "You are not a member of this team")

        # Verify content exists and belongs to user
        content = db.query(ContentVector).filter(
            and_(ContentVector.id == content_id, ContentVector.user_id == user_id)
        ).first()
        if not content:
            raise ValueError("Content not found or doesn't belong to you")

        # Check if already shared
        existing = db.query(TeamContent).filter(
            and_(TeamContent.team_id == team_id, TeamContent.content_id == content_id)
        ).first()
        if existing:
            raise ValueError("Content is already shared with this team")

        tc = TeamContent(
            team_id=team_id,
            content_id=content_id,
            shared_by=user_id
        )
        db.add(tc)
        db.commit()
        return {"content_id": content_id, "team_id": team_id}

    @staticmethod
    def unshare_content(db: Session, team_id: str, user_id: int, content_id: str):
        """Unshare content. Sharer, admin, or owner can unshare."""
        membership = db.query(TeamMember).filter(
            and_(TeamMember.team_id == team_id, TeamMember.user_id == user_id)
        ).first()
        if not membership:
            raise PermissionError("access_denied", "You are not a member of this team")

        tc = db.query(TeamContent).filter(
            and_(TeamContent.team_id == team_id, TeamContent.content_id == content_id)
        ).first()
        if not tc:
            raise ValueError("Shared content not found")

        # Only sharer, admin, or owner can unshare
        if tc.shared_by != user_id and membership.role not in ("owner", "admin"):
            raise PermissionError("access_denied", "Only the sharer, admin, or owner can unshare")

        db.delete(tc)
        db.commit()

    @staticmethod
    def get_shared_content(db: Session, team_id: str, user_id: int) -> List[dict]:
        """Get all shared content in a team."""
        membership = db.query(TeamMember).filter(
            and_(TeamMember.team_id == team_id, TeamMember.user_id == user_id)
        ).first()
        if not membership:
            raise PermissionError("access_denied", "You are not a member of this team")

        shared = db.query(TeamContent).filter(TeamContent.team_id == team_id).all()
        result = []
        for tc in shared:
            content = db.query(ContentVector).filter(ContentVector.id == tc.content_id).first()
            if content:
                sharer = db.query(User).filter(User.id == tc.shared_by).first()
                result.append({
                    "id": content.id,
                    "title": content.title,
                    "summary": content.summary,
                    "content_type": content.content_type,
                    "mode": content.mode,
                    "source_url": content.source_url,
                    "tags": content.tags,
                    "shared_by": {
                        "user_id": tc.shared_by,
                        "name": sharer.full_name or sharer.email if sharer else "Unknown"
                    },
                    "shared_at": tc.shared_at.isoformat() if tc.shared_at else None,
                })
        return result
