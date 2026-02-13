"""
Tags Pydantic Models
Request/Response schemas for tags
"""

from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


# =============================================
# Tag Models
# =============================================
class TagCreate(BaseModel):
    """Schema for creating a tag"""
    name: str = Field(..., min_length=1, max_length=100, description="Tag name")
    color: Optional[str] = Field("#3B82F6", pattern=r"^#[0-9A-Fa-f]{6}$", description="Hex color code")


class TagUpdate(BaseModel):
    """Schema for updating a tag"""
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    color: Optional[str] = Field(None, pattern=r"^#[0-9A-Fa-f]{6}$")


class TagResponse(BaseModel):
    """Schema for tag response"""
    id: int
    name: str
    color: str
    created_at: datetime
    content_count: int = 0  # Number of contents with this tag

    class Config:
        from_attributes = True


class TagsListResponse(BaseModel):
    """Response for listing tags"""
    tags: List[TagResponse]
    total: int


# =============================================
# Content Tag Models
# =============================================
class ContentTagAdd(BaseModel):
    """Schema for adding tags to content"""
    tag_ids: List[int] = Field(..., description="List of tag IDs to add")


class ContentTagResponse(BaseModel):
    """Tag info for content"""
    id: int
    name: str
    color: str


class ContentTagsResponse(BaseModel):
    """Response for content tags"""
    content_id: str
    tags: List[ContentTagResponse]


# =============================================
# Bulk Operations
# =============================================
class BulkTagRequest(BaseModel):
    """Schema for bulk tagging multiple contents"""
    content_ids: List[str]
    tag_ids: List[int]


class BulkTagResponse(BaseModel):
    """Response for bulk tagging"""
    tagged_count: int
    content_ids: List[str]
