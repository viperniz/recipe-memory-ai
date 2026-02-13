"""
Notes Service
CRUD operations for notes and bookmarks
"""

from typing import List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import and_

from database import Note, Bookmark, User
from .models import (
    NoteCreate,
    NoteUpdate,
    NoteResponse,
    BookmarkCreate,
    BookmarkResponse,
    ContentAnnotations
)


class NotesService:
    """Service for managing notes and bookmarks"""

    # =============================================
    # Notes CRUD
    # =============================================
    @staticmethod
    def create_note(db: Session, user_id: int, note_data: NoteCreate) -> Note:
        """Create a new note"""
        db_note = Note(
            user_id=user_id,
            content_id=note_data.content_id,
            note_text=note_data.note_text,
            timestamp_seconds=note_data.timestamp_seconds
        )
        db.add(db_note)
        db.commit()
        db.refresh(db_note)
        return db_note

    @staticmethod
    def get_note(db: Session, note_id: int, user_id: int) -> Optional[Note]:
        """Get a specific note (must belong to user)"""
        return db.query(Note).filter(
            and_(Note.id == note_id, Note.user_id == user_id)
        ).first()

    @staticmethod
    def get_notes_for_content(
        db: Session,
        user_id: int,
        content_id: str
    ) -> List[Note]:
        """Get all notes for a specific content"""
        return db.query(Note).filter(
            and_(Note.user_id == user_id, Note.content_id == content_id)
        ).order_by(Note.timestamp_seconds.asc().nullsfirst(), Note.created_at.asc()).all()

    @staticmethod
    def get_all_notes(
        db: Session,
        user_id: int,
        skip: int = 0,
        limit: int = 100
    ) -> List[Note]:
        """Get all notes for a user"""
        return db.query(Note).filter(
            Note.user_id == user_id
        ).order_by(Note.created_at.desc()).offset(skip).limit(limit).all()

    @staticmethod
    def update_note(
        db: Session,
        note_id: int,
        user_id: int,
        note_data: NoteUpdate
    ) -> Optional[Note]:
        """Update a note"""
        db_note = NotesService.get_note(db, note_id, user_id)
        if not db_note:
            return None

        if note_data.note_text is not None:
            db_note.note_text = note_data.note_text
        if note_data.timestamp_seconds is not None:
            db_note.timestamp_seconds = note_data.timestamp_seconds

        db.commit()
        db.refresh(db_note)
        return db_note

    @staticmethod
    def delete_note(db: Session, note_id: int, user_id: int) -> bool:
        """Delete a note"""
        db_note = NotesService.get_note(db, note_id, user_id)
        if not db_note:
            return False

        db.delete(db_note)
        db.commit()
        return True

    @staticmethod
    def count_notes(db: Session, user_id: int, content_id: Optional[str] = None) -> int:
        """Count notes for a user, optionally filtered by content"""
        query = db.query(Note).filter(Note.user_id == user_id)
        if content_id:
            query = query.filter(Note.content_id == content_id)
        return query.count()

    # =============================================
    # Bookmarks CRUD
    # =============================================
    @staticmethod
    def create_bookmark(db: Session, user_id: int, bookmark_data: BookmarkCreate) -> Bookmark:
        """Create a new bookmark"""
        db_bookmark = Bookmark(
            user_id=user_id,
            content_id=bookmark_data.content_id,
            timestamp_seconds=bookmark_data.timestamp_seconds,
            label=bookmark_data.label
        )
        db.add(db_bookmark)
        db.commit()
        db.refresh(db_bookmark)
        return db_bookmark

    @staticmethod
    def get_bookmark(db: Session, bookmark_id: int, user_id: int) -> Optional[Bookmark]:
        """Get a specific bookmark (must belong to user)"""
        return db.query(Bookmark).filter(
            and_(Bookmark.id == bookmark_id, Bookmark.user_id == user_id)
        ).first()

    @staticmethod
    def get_bookmarks_for_content(
        db: Session,
        user_id: int,
        content_id: str
    ) -> List[Bookmark]:
        """Get all bookmarks for a specific content"""
        return db.query(Bookmark).filter(
            and_(Bookmark.user_id == user_id, Bookmark.content_id == content_id)
        ).order_by(Bookmark.timestamp_seconds.asc()).all()

    @staticmethod
    def get_all_bookmarks(
        db: Session,
        user_id: int,
        skip: int = 0,
        limit: int = 100
    ) -> List[Bookmark]:
        """Get all bookmarks for a user"""
        return db.query(Bookmark).filter(
            Bookmark.user_id == user_id
        ).order_by(Bookmark.created_at.desc()).offset(skip).limit(limit).all()

    @staticmethod
    def delete_bookmark(db: Session, bookmark_id: int, user_id: int) -> bool:
        """Delete a bookmark"""
        db_bookmark = NotesService.get_bookmark(db, bookmark_id, user_id)
        if not db_bookmark:
            return False

        db.delete(db_bookmark)
        db.commit()
        return True

    @staticmethod
    def count_bookmarks(db: Session, user_id: int, content_id: Optional[str] = None) -> int:
        """Count bookmarks for a user, optionally filtered by content"""
        query = db.query(Bookmark).filter(Bookmark.user_id == user_id)
        if content_id:
            query = query.filter(Bookmark.content_id == content_id)
        return query.count()

    # =============================================
    # Combined Operations
    # =============================================
    @staticmethod
    def get_content_annotations(
        db: Session,
        user_id: int,
        content_id: str
    ) -> ContentAnnotations:
        """Get all annotations (notes + bookmarks) for a content"""
        notes = NotesService.get_notes_for_content(db, user_id, content_id)
        bookmarks = NotesService.get_bookmarks_for_content(db, user_id, content_id)

        return ContentAnnotations(
            content_id=content_id,
            notes=[NoteResponse.model_validate(n) for n in notes],
            bookmarks=[BookmarkResponse.model_validate(b) for b in bookmarks]
        )

    @staticmethod
    def delete_all_for_content(db: Session, user_id: int, content_id: str) -> dict:
        """Delete all notes and bookmarks for a content (useful when deleting content)"""
        notes_deleted = db.query(Note).filter(
            and_(Note.user_id == user_id, Note.content_id == content_id)
        ).delete()

        bookmarks_deleted = db.query(Bookmark).filter(
            and_(Bookmark.user_id == user_id, Bookmark.content_id == content_id)
        ).delete()

        db.commit()

        return {
            "notes_deleted": notes_deleted,
            "bookmarks_deleted": bookmarks_deleted
        }
