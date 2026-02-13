"""
Notes Module for Video Memory AI
Handles notes and bookmarks for video content
"""

from .models import (
    NoteCreate,
    NoteUpdate,
    NoteResponse,
    BookmarkCreate,
    BookmarkResponse
)
from .service import NotesService

__all__ = [
    "NoteCreate",
    "NoteUpdate",
    "NoteResponse",
    "BookmarkCreate",
    "BookmarkResponse",
    "NotesService"
]
