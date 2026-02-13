"""
Tags Service
CRUD operations for tags and content tagging
"""

from typing import List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import and_, func

from database import UserTag, ContentTag
from .models import (
    TagCreate,
    TagUpdate,
    TagResponse,
    ContentTagResponse,
    ContentTagsResponse
)


class TagsService:
    """Service for managing tags"""

    # =============================================
    # Tag CRUD
    # =============================================
    @staticmethod
    def create_tag(db: Session, user_id: int, tag_data: TagCreate) -> UserTag:
        """Create a new tag"""
        db_tag = UserTag(
            user_id=user_id,
            name=tag_data.name,
            color=tag_data.color or "#3B82F6"
        )
        db.add(db_tag)
        db.commit()
        db.refresh(db_tag)
        return db_tag

    @staticmethod
    def get_tag(db: Session, tag_id: int, user_id: int) -> Optional[UserTag]:
        """Get a specific tag (must belong to user)"""
        return db.query(UserTag).filter(
            and_(UserTag.id == tag_id, UserTag.user_id == user_id)
        ).first()

    @staticmethod
    def get_tag_by_name(db: Session, name: str, user_id: int) -> Optional[UserTag]:
        """Get a tag by name"""
        return db.query(UserTag).filter(
            and_(UserTag.name == name, UserTag.user_id == user_id)
        ).first()

    @staticmethod
    def get_all_tags(db: Session, user_id: int) -> List[TagResponse]:
        """Get all tags for a user with content counts"""
        tags = db.query(UserTag).filter(UserTag.user_id == user_id).all()

        result = []
        for tag in tags:
            # Count contents with this tag
            content_count = db.query(ContentTag).filter(
                ContentTag.tag_id == tag.id
            ).count()

            result.append(TagResponse(
                id=tag.id,
                name=tag.name,
                color=tag.color,
                created_at=tag.created_at,
                content_count=content_count
            ))

        return result

    @staticmethod
    def update_tag(
        db: Session,
        tag_id: int,
        user_id: int,
        tag_data: TagUpdate
    ) -> Optional[UserTag]:
        """Update a tag"""
        db_tag = TagsService.get_tag(db, tag_id, user_id)
        if not db_tag:
            return None

        if tag_data.name is not None:
            db_tag.name = tag_data.name
        if tag_data.color is not None:
            db_tag.color = tag_data.color

        db.commit()
        db.refresh(db_tag)
        return db_tag

    @staticmethod
    def delete_tag(db: Session, tag_id: int, user_id: int) -> bool:
        """Delete a tag and all its content associations"""
        db_tag = TagsService.get_tag(db, tag_id, user_id)
        if not db_tag:
            return False

        # Delete all content-tag associations
        db.query(ContentTag).filter(ContentTag.tag_id == tag_id).delete()

        # Delete the tag
        db.delete(db_tag)
        db.commit()
        return True

    # =============================================
    # Content Tagging
    # =============================================
    @staticmethod
    def add_tags_to_content(
        db: Session,
        user_id: int,
        content_id: str,
        tag_ids: List[int]
    ) -> ContentTagsResponse:
        """Add multiple tags to a content"""
        # Verify all tags belong to user
        tags = db.query(UserTag).filter(
            and_(UserTag.id.in_(tag_ids), UserTag.user_id == user_id)
        ).all()

        valid_tag_ids = {tag.id for tag in tags}

        for tag_id in tag_ids:
            if tag_id not in valid_tag_ids:
                continue

            # Check if association already exists
            existing = db.query(ContentTag).filter(
                and_(
                    ContentTag.content_id == content_id,
                    ContentTag.tag_id == tag_id,
                    ContentTag.user_id == user_id
                )
            ).first()

            if not existing:
                db_content_tag = ContentTag(
                    content_id=content_id,
                    tag_id=tag_id,
                    user_id=user_id
                )
                db.add(db_content_tag)

        db.commit()

        return TagsService.get_content_tags(db, user_id, content_id)

    @staticmethod
    def remove_tag_from_content(
        db: Session,
        user_id: int,
        content_id: str,
        tag_id: int
    ) -> bool:
        """Remove a tag from a content"""
        result = db.query(ContentTag).filter(
            and_(
                ContentTag.content_id == content_id,
                ContentTag.tag_id == tag_id,
                ContentTag.user_id == user_id
            )
        ).delete()

        db.commit()
        return result > 0

    @staticmethod
    def get_content_tags(
        db: Session,
        user_id: int,
        content_id: str
    ) -> ContentTagsResponse:
        """Get all tags for a content"""
        content_tags = db.query(ContentTag).filter(
            and_(ContentTag.content_id == content_id, ContentTag.user_id == user_id)
        ).all()

        tags = []
        for ct in content_tags:
            tag = db.query(UserTag).filter(UserTag.id == ct.tag_id).first()
            if tag:
                tags.append(ContentTagResponse(
                    id=tag.id,
                    name=tag.name,
                    color=tag.color
                ))

        return ContentTagsResponse(content_id=content_id, tags=tags)

    @staticmethod
    def get_contents_by_tag(
        db: Session,
        user_id: int,
        tag_id: int
    ) -> List[str]:
        """Get all content IDs with a specific tag"""
        content_tags = db.query(ContentTag).filter(
            and_(ContentTag.tag_id == tag_id, ContentTag.user_id == user_id)
        ).all()

        return [ct.content_id for ct in content_tags]

    @staticmethod
    def get_contents_by_tags(
        db: Session,
        user_id: int,
        tag_ids: List[int],
        match_all: bool = False
    ) -> List[str]:
        """
        Get content IDs that have specified tags.
        If match_all=True, content must have ALL tags.
        If match_all=False, content must have ANY of the tags.
        """
        if not tag_ids:
            return []

        if match_all:
            # Content must have ALL specified tags
            content_ids = None
            for tag_id in tag_ids:
                tag_content_ids = set(TagsService.get_contents_by_tag(db, user_id, tag_id))
                if content_ids is None:
                    content_ids = tag_content_ids
                else:
                    content_ids &= tag_content_ids

            return list(content_ids) if content_ids else []
        else:
            # Content must have ANY of the tags
            content_tags = db.query(ContentTag.content_id).filter(
                and_(
                    ContentTag.tag_id.in_(tag_ids),
                    ContentTag.user_id == user_id
                )
            ).distinct().all()

            return [ct[0] for ct in content_tags]

    @staticmethod
    def delete_all_tags_for_content(db: Session, user_id: int, content_id: str) -> int:
        """Delete all tag associations for a content"""
        result = db.query(ContentTag).filter(
            and_(ContentTag.content_id == content_id, ContentTag.user_id == user_id)
        ).delete()

        db.commit()
        return result
