"""
Tags Module for Video Memory AI
Handles user-defined tags and content tagging
"""

from .models import (
    TagCreate,
    TagUpdate,
    TagResponse,
    ContentTagAdd,
    ContentTagsResponse
)
from .service import TagsService

__all__ = [
    "TagCreate",
    "TagUpdate",
    "TagResponse",
    "ContentTagAdd",
    "ContentTagsResponse",
    "TagsService"
]
