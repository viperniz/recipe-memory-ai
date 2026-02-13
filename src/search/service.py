"""
Search Service
Advanced search across content, notes, and tags
"""

from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_

from database import Note, UserTag, ContentTag
from tags.service import TagsService


class SearchService:
    """Service for searching content"""

    @staticmethod
    def search(
        content_memory,
        db: Session,
        user_id: int,
        query: Optional[str] = None,
        tag_ids: Optional[List[int]] = None,
        content_type: Optional[str] = None,
        has_notes: Optional[bool] = None,
        has_bookmarks: Optional[bool] = None,
        n_results: int = 20,
        match_all_tags: bool = False
    ) -> List[Dict[str, Any]]:
        """
        Search for content with multiple filters.

        Args:
            content_memory: ContentMemory instance
            db: Database session
            user_id: Current user ID
            query: Text search query
            tag_ids: Filter by tag IDs
            content_type: Filter by content type
            has_notes: Filter to contents with notes
            has_bookmarks: Filter to contents with bookmarks
            n_results: Maximum results
            match_all_tags: If True, content must have ALL tags

        Returns:
            List of matching content
        """
        # Start with all user's content
        all_content = content_memory.list_all(user_id=user_id)
        content_ids = {c["id"] for c in all_content}

        # Filter by tags if specified
        if tag_ids:
            tagged_ids = set(TagsService.get_contents_by_tags(
                db, user_id, tag_ids, match_all=match_all_tags
            ))
            content_ids &= tagged_ids

        # Filter by content type
        if content_type:
            type_ids = {
                c["id"] for c in all_content
                if c.get("content_type") == content_type
            }
            content_ids &= type_ids

        # Filter by has_notes
        if has_notes is not None:
            notes_content_ids = set(
                db.query(Note.content_id).filter(Note.user_id == user_id).distinct().all()
            )
            notes_content_ids = {n[0] for n in notes_content_ids}

            if has_notes:
                content_ids &= notes_content_ids
            else:
                content_ids -= notes_content_ids

        # If there's a text query, use semantic search
        if query and query.strip():
            search_results = content_memory.search(
                query=query,
                user_id=user_id,
                n_results=n_results * 2,  # Get more for filtering
                content_type=content_type
            )

            # Filter to content_ids that passed other filters
            results = [
                r for r in search_results
                if r.get("id") in content_ids
            ][:n_results]
        else:
            # No text query - just return filtered content
            results = [
                c for c in all_content
                if c["id"] in content_ids
            ][:n_results]

        # Enrich results with tag info
        for result in results:
            content_tags = TagsService.get_content_tags(db, user_id, result["id"])
            result["user_tags"] = [
                {"id": t.id, "name": t.name, "color": t.color}
                for t in content_tags.tags
            ]

            # Add note count
            note_count = db.query(Note).filter(
                and_(Note.user_id == user_id, Note.content_id == result["id"])
            ).count()
            result["note_count"] = note_count

        return results

    @staticmethod
    def search_in_notes(
        db: Session,
        user_id: int,
        query: str
    ) -> List[Dict[str, Any]]:
        """
        Search for notes containing text.
        Returns notes grouped by content_id.
        """
        notes = db.query(Note).filter(
            and_(
                Note.user_id == user_id,
                Note.note_text.ilike(f"%{query}%")
            )
        ).all()

        # Group by content_id
        results = {}
        for note in notes:
            if note.content_id not in results:
                results[note.content_id] = {
                    "content_id": note.content_id,
                    "matching_notes": []
                }
            results[note.content_id]["matching_notes"].append({
                "id": note.id,
                "text": note.note_text,
                "timestamp_seconds": note.timestamp_seconds
            })

        return list(results.values())

    @staticmethod
    def get_suggested_tags(
        db: Session,
        user_id: int,
        content_ids: List[str]
    ) -> List[Dict[str, Any]]:
        """
        Get tag suggestions based on commonly used tags for similar content.
        Returns tags ordered by frequency.
        """
        # Get all tags used on the specified contents
        content_tags = db.query(ContentTag.tag_id).filter(
            and_(
                ContentTag.user_id == user_id,
                ContentTag.content_id.in_(content_ids)
            )
        ).all()

        # Count tag frequency
        tag_counts = {}
        for ct in content_tags:
            tag_id = ct[0]
            tag_counts[tag_id] = tag_counts.get(tag_id, 0) + 1

        # Get tag details and sort by frequency
        suggestions = []
        for tag_id, count in sorted(tag_counts.items(), key=lambda x: -x[1]):
            tag = db.query(UserTag).filter(UserTag.id == tag_id).first()
            if tag:
                suggestions.append({
                    "id": tag.id,
                    "name": tag.name,
                    "color": tag.color,
                    "frequency": count
                })

        return suggestions

    @staticmethod
    def get_content_types(content_memory, user_id: int) -> List[str]:
        """Get all unique content types for a user"""
        all_content = content_memory.list_all(user_id=user_id)
        content_types = set()
        for c in all_content:
            ct = c.get("content_type")
            if ct:
                content_types.add(ct)
        return sorted(list(content_types))

    @staticmethod
    def get_search_stats(
        content_memory,
        db: Session,
        user_id: int
    ) -> Dict[str, Any]:
        """Get statistics for the user's content"""
        all_content = content_memory.list_all(user_id=user_id)

        # Count by content type
        type_counts = {}
        for c in all_content:
            ct = c.get("content_type", "unknown")
            type_counts[ct] = type_counts.get(ct, 0) + 1

        # Get tag stats
        tags = TagsService.get_all_tags(db, user_id)
        tag_stats = [
            {"name": t.name, "color": t.color, "count": t.content_count}
            for t in tags
        ]

        # Note counts
        total_notes = db.query(Note).filter(Note.user_id == user_id).count()

        return {
            "total_content": len(all_content),
            "content_by_type": type_counts,
            "total_tags": len(tags),
            "tag_usage": tag_stats[:10],  # Top 10 tags
            "total_notes": total_notes
        }
