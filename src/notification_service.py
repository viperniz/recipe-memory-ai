"""
Notification Service
Create and manage in-app notifications
"""

import logging
from datetime import datetime
from sqlalchemy.orm import Session

from database import Notification

logger = logging.getLogger(__name__)


def create_notification(
    db: Session,
    user_id: int,
    type: str,
    title: str,
    message: str = "",
    link: str = None,
) -> Notification:
    """Create a new notification for a user."""
    notif = Notification(
        user_id=user_id,
        type=type,
        title=title,
        message=message,
        link=link,
    )
    db.add(notif)
    db.commit()
    db.refresh(notif)
    return notif


def get_notifications(db: Session, user_id: int, limit: int = 30, offset: int = 0):
    """Get user notifications, newest first."""
    return (
        db.query(Notification)
        .filter(Notification.user_id == user_id)
        .order_by(Notification.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )


def get_unread_count(db: Session, user_id: int) -> int:
    """Get count of unread notifications."""
    return (
        db.query(Notification)
        .filter(Notification.user_id == user_id, Notification.is_read == False)
        .count()
    )


def mark_read(db: Session, user_id: int, notification_id: int) -> bool:
    """Mark a single notification as read."""
    notif = (
        db.query(Notification)
        .filter(Notification.id == notification_id, Notification.user_id == user_id)
        .first()
    )
    if not notif:
        return False
    notif.is_read = True
    db.commit()
    return True


def mark_all_read(db: Session, user_id: int) -> int:
    """Mark all notifications as read. Returns count updated."""
    count = (
        db.query(Notification)
        .filter(Notification.user_id == user_id, Notification.is_read == False)
        .update({"is_read": True})
    )
    db.commit()
    return count
