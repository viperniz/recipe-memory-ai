"""
Notes Pydantic Models
Request/Response schemas for notes and bookmarks
"""

from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


# =============================================
# Note Models
# =============================================
class NoteCreate(BaseModel):
    """Schema for creating a note"""
    content_id: str = Field(..., description="ID of the content this note is for")
    note_text: str = Field(..., min_length=1, description="The note text")
    timestamp_seconds: Optional[float] = Field(None, description="Timestamp in the video (seconds)")


class NoteUpdate(BaseModel):
    """Schema for updating a note"""
    note_text: Optional[str] = Field(None, min_length=1)
    timestamp_seconds: Optional[float] = None


class NoteResponse(BaseModel):
    """Schema for note response"""
    id: int
    content_id: str
    note_text: str
    timestamp_seconds: Optional[float]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class NotesListResponse(BaseModel):
    """Response for listing notes"""
    notes: List[NoteResponse]
    total: int


# =============================================
# Bookmark Models
# =============================================
class BookmarkCreate(BaseModel):
    """Schema for creating a bookmark"""
    content_id: str = Field(..., description="ID of the content this bookmark is for")
    timestamp_seconds: float = Field(..., ge=0, description="Timestamp in the video (seconds)")
    label: Optional[str] = Field(None, max_length=255, description="Optional label for the bookmark")


class BookmarkResponse(BaseModel):
    """Schema for bookmark response"""
    id: int
    content_id: str
    timestamp_seconds: float
    label: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class BookmarksListResponse(BaseModel):
    """Response for listing bookmarks"""
    bookmarks: List[BookmarkResponse]
    total: int


# =============================================
# Combined Response (for content detail view)
# =============================================
class ContentAnnotations(BaseModel):
    """All annotations for a piece of content"""
    content_id: str
    notes: List[NoteResponse]
    bookmarks: List[BookmarkResponse]
