"""
Vector Memory using PostgreSQL pgvector
Replaces ChromaDB for scalable multi-user deployment
"""
import json
import re
import time
from typing import List, Optional, Dict
from sqlalchemy.orm import Session, load_only
from sqlalchemy import func, text
from datetime import datetime
from database import ContentVector, EntityVector, Collection
from config import get_config

try:
    from sentence_transformers import SentenceTransformer
    SENTENCE_TRANSFORMERS_AVAILABLE = True
except ImportError:
    SENTENCE_TRANSFORMERS_AVAILABLE = False
    print("[VectorMemory] WARNING: sentence-transformers not installed. Install with: pip install sentence-transformers")

# Module-level cache for the embedding model (loaded once, reused across all instances)
_cached_embedding_model = None
_cached_embedding_model_name = None


class VectorMemory:
    def __init__(self, db: Session, user_id: Optional[int] = None):
        """
        Initialize vector memory with database session

        Args:
            db: SQLAlchemy database session
            user_id: Optional user ID for multi-tenant isolation
        """
        self.db = db
        self.user_id = user_id

        config = get_config()
        self.embedding_model_name = config.vector.embedding_model

    def _get_embedding_model(self):
        """Get embedding model (cached at module level — loaded once per process)"""
        global _cached_embedding_model, _cached_embedding_model_name

        if not SENTENCE_TRANSFORMERS_AVAILABLE:
            raise ImportError("sentence-transformers is required. Install with: pip install sentence-transformers")

        if _cached_embedding_model is None or _cached_embedding_model_name != self.embedding_model_name:
            print(f"[VectorMemory] Loading embedding model: {self.embedding_model_name}")
            _cached_embedding_model = SentenceTransformer(self.embedding_model_name)
            _cached_embedding_model_name = self.embedding_model_name
        return _cached_embedding_model
    
    def _generate_embedding(self, text: str) -> List[float]:
        """Generate embedding for text"""
        model = self._get_embedding_model()
        embedding = model.encode(text, normalize_embeddings=True)
        return embedding.tolist()
    
    def _create_searchable_text(self, content: Dict) -> str:
        """Create searchable text from content"""
        parts = [
            f"Title: {content.get('title', '')}",
            f"Summary: {content.get('summary', '')}",
            f"Type: {content.get('content_type', '')}",
            "Topics: " + ", ".join(content.get("topics", [])),
            "Key Points: " + " ".join([
                kp.get("point", str(kp)) if isinstance(kp, dict) else str(kp)
                for kp in content.get("key_points", [])
            ]),
            "Entities: " + ", ".join([
                e.get("name", str(e)) if isinstance(e, dict) else str(e)
                for e in content.get("entities", [])
            ]),
            "Action Items: " + " ".join(content.get("action_items", [])),
            "Tags: " + ", ".join(content.get("tags", [])),
            content.get("transcript", "")[:1000]  # First 1000 chars of transcript
        ]
        return "\n".join(filter(None, parts))
    
    @staticmethod
    def _extract_youtube_id(url: str) -> Optional[str]:
        """Extract YouTube video ID from various URL formats."""
        m = re.search(r'(?:v=|youtu\.be/|/embed/|/v/|/shorts/)([A-Za-z0-9_-]{11})', url)
        return m.group(1) if m else None

    def find_by_source_url(self, source_url: str, user_id: Optional[int] = None) -> Optional[str]:
        """Find existing content_id by source URL (normalizes YouTube URLs).

        Returns the content_id if a match is found, otherwise None.
        """
        user_id = user_id or self.user_id
        if user_id is None:
            raise ValueError("user_id must be provided")

        video_id = self._extract_youtube_id(source_url)
        if video_id:
            # Match any row whose source_url contains the same YouTube video ID
            row = self.db.query(ContentVector.id).filter(
                ContentVector.user_id == user_id,
                ContentVector.source_url.contains(video_id)
            ).order_by(ContentVector.created_at.desc()).first()
        else:
            # Non-YouTube: exact match
            row = self.db.query(ContentVector.id).filter(
                ContentVector.user_id == user_id,
                ContentVector.source_url == source_url
            ).order_by(ContentVector.created_at.desc()).first()

        return row[0] if row else None

    def add_content(self, content: Dict, user_id: Optional[int] = None) -> str:
        """
        Add content to vector database
        
        Args:
            content: Content dictionary
            user_id: User ID (uses self.user_id if not provided)
        
        Returns:
            Content ID
        """
        user_id = user_id or self.user_id
        if user_id is None:
            raise ValueError("user_id must be provided")
        
        content_id = content.get("id", f"content_{int(time.time())}")
        searchable_text = self._create_searchable_text(content)
        embedding = self._generate_embedding(searchable_text)
        
        # Check if content already exists
        existing = self.db.query(ContentVector).filter(
            ContentVector.id == content_id,
            ContentVector.user_id == user_id
        ).first()
        
        if existing:
            # Update existing
            existing.embedding = embedding
            existing.title = content.get("title", "")
            existing.summary = content.get("summary", "")
            existing.mode = content.get("mode", "general")
            existing.topics = content.get("topics", [])
            existing.tags = content.get("tags", [])
            existing.collections = content.get("collections", [])
            existing.source_url = content.get("source_url", "")
            existing.has_transcript = bool(content.get("transcript"))
            existing.full_content = content
            existing.searchable_text = searchable_text
            existing.updated_at = datetime.utcnow()
            if content.get("file_size_bytes"):
                existing.file_size_bytes = content["file_size_bytes"]
        else:
            # Create new
            vector = ContentVector(
                id=content_id,
                user_id=user_id,
                embedding=embedding,
                title=content.get("title", ""),
                content_type=content.get("content_type", "other"),
                mode=content.get("mode", "general"),
                summary=content.get("summary", ""),
                topics=content.get("topics", []),
                tags=content.get("tags", []),
                collections=content.get("collections", []),
                source_url=content.get("source_url", ""),
                has_transcript=bool(content.get("transcript")),
                full_content=content,
                searchable_text=searchable_text,
                file_size_bytes=content.get("file_size_bytes", 0)
            )
            self.db.add(vector)
        
        # Add entities if provided
        entities = content.get("entities", [])
        if entities:
            # Delete old entities
            self.db.query(EntityVector).filter(
                EntityVector.content_id == content_id,
                EntityVector.user_id == user_id
            ).delete()
            
            # Add new entities
            for entity in entities:
                entity_text = f"{entity.get('name', '')} {entity.get('type', '')} {entity.get('description', '')}"
                entity_embedding = self._generate_embedding(entity_text)
                
                entity_vec = EntityVector(
                    user_id=user_id,
                    content_id=content_id,
                    entity_name=entity.get("name", ""),
                    entity_type=entity.get("type", ""),
                    embedding=entity_embedding
                )
                self.db.add(entity_vec)
        
        self.db.commit()
        print(f"Added content: {content.get('title', 'Unknown')} (ID: {content_id})")
        return content_id
    
    def search(
        self,
        query: str,
        n_results: int = 5,
        content_type: str = None,
        user_id: Optional[int] = None,
        collection_id: Optional[str] = None
    ) -> List[Dict]:
        """
        Search content using vector similarity

        Args:
            query: Search query text
            n_results: Number of results to return
            content_type: Filter by content type
            user_id: User ID (uses self.user_id if not provided)
            collection_id: Optional collection ID to scope search

        Returns:
            List of content dictionaries with similarity scores
        """
        user_id = user_id or self.user_id
        if user_id is None:
            raise ValueError("user_id must be provided")

        # Generate query embedding
        query_embedding = self._generate_embedding(query)

        # Build query
        query_obj = self.db.query(ContentVector).filter(
            ContentVector.user_id == user_id
        )

        # Apply filters
        if content_type:
            query_obj = query_obj.filter(
                ContentVector.content_type == content_type
            )

        # Load all candidate vectors (both DB backends calculate similarity in Python)
        all_vectors = query_obj.all()

        # Pre-filter by collection membership if scoped
        if collection_id:
            all_vectors = [v for v in all_vectors if collection_id in (v.collections or [])]

        # Calculate cosine similarity for each candidate
        import numpy as np
        results = []
        for vec in all_vectors:
            similarity = np.dot(np.array(vec.embedding), np.array(query_embedding)) / (
                np.linalg.norm(vec.embedding) * np.linalg.norm(query_embedding)
            )
            results.append((similarity, vec))

        results.sort(key=lambda x: x[0], reverse=True)
        results = [r[1] for r in results[:n_results]]
        
        # Convert to dicts with similarity scores
        contents = []
        for vec in results:
            content = vec.full_content.copy()
            # Calculate similarity for display
            import numpy as np
            similarity = np.dot(np.array(vec.embedding), np.array(query_embedding)) / (
                np.linalg.norm(vec.embedding) * np.linalg.norm(query_embedding)
            )
            content["_similarity"] = float(similarity)
            contents.append(content)
        
        return contents
    
    def search_by_topic(
        self,
        topics: List[str],
        n_results: int = 5,
        user_id: Optional[int] = None
    ) -> List[Dict]:
        """Find content that covers specific topics"""
        query = ", ".join(topics)
        return self.search(query, n_results, user_id=user_id)
    
    def search_by_entity(
        self,
        entity_names: List[str],
        n_results: int = 5,
        user_id: Optional[int] = None
    ) -> List[Dict]:
        """Find content mentioning specific entities"""
        user_id = user_id or self.user_id
        if user_id is None:
            raise ValueError("user_id must be provided")
        
        query = ", ".join(entity_names)
        query_embedding = self._generate_embedding(query)
        
        # Search in entity vectors
        entity_query = self.db.query(EntityVector).filter(
            EntityVector.user_id == user_id
        )
        
        # Calculate similarity
        import numpy as np
        results = []
        for entity_vec in entity_query.all():
            similarity = np.dot(np.array(entity_vec.embedding), np.array(query_embedding)) / (
                np.linalg.norm(entity_vec.embedding) * np.linalg.norm(query_embedding)
            )
            results.append((similarity, entity_vec))
        
        results.sort(key=lambda x: x[0], reverse=True)
        results = results[:n_results]
        
        # Get content for matched entities
        content_ids = [r[1].content_id for r in results]
        contents = []
        for content_id in content_ids:
            content = self.get_content(content_id, user_id)
            if content:
                contents.append(content)
        
        return contents
    
    def get_content(self, content_id: str, user_id: Optional[int] = None) -> Optional[Dict]:
        """Get content by ID"""
        user_id = user_id or self.user_id
        if user_id is None:
            raise ValueError("user_id must be provided")
        
        vector = self.db.query(ContentVector).filter(
            ContentVector.id == content_id,
            ContentVector.user_id == user_id
        ).first()
        
        if vector:
            return vector.full_content
        return None
    
    def list_all(self, user_id: Optional[int] = None) -> List[Dict]:
        """List all content for user (returns full content dicts)"""
        user_id = user_id or self.user_id
        if user_id is None:
            raise ValueError("user_id must be provided")
        
        vectors = self.db.query(ContentVector).filter(
            ContentVector.user_id == user_id
        ).order_by(ContentVector.created_at.desc()).all()

        return [v.full_content for v in vectors]
    
    def count_user_content(self, user_id: int) -> int:
        """Count content for user"""
        return self.db.query(ContentVector).filter(
            ContentVector.user_id == user_id
        ).count()
    
    def update_content(self, content_id: str, content: Dict, user_id: Optional[int] = None) -> bool:
        """Update the full_content JSON for an existing content record.

        Used by backfill operations to add thumbnails, captions, etc.
        """
        user_id = user_id or self.user_id
        if user_id is None:
            raise ValueError("user_id must be provided")

        vector = self.db.query(ContentVector).filter(
            ContentVector.id == content_id,
            ContentVector.user_id == user_id
        ).first()

        if not vector:
            return False

        vector.full_content = content
        vector.updated_at = datetime.utcnow()
        self.db.commit()
        return True

    def delete_content(self, content_id: str, user_id: Optional[int] = None) -> bool:
        """Delete content"""
        user_id = user_id or self.user_id
        if user_id is None:
            raise ValueError("user_id must be provided")

        # Delete entities first
        self.db.query(EntityVector).filter(
            EntityVector.content_id == content_id,
            EntityVector.user_id == user_id
        ).delete()

        # Delete content
        deleted = self.db.query(ContentVector).filter(
            ContentVector.id == content_id,
            ContentVector.user_id == user_id
        ).delete()

        self.db.commit()
        return deleted > 0

    # =============================================
    # Collection Management
    # =============================================

    def create_collection(self, name: str, description: str = "", user_id: Optional[int] = None) -> str:
        """Create a new collection"""
        import uuid as _uuid
        user_id = user_id or self.user_id
        if user_id is None:
            raise ValueError("user_id must be provided")

        collection_id = f"coll_{_uuid.uuid4().hex[:8]}"
        coll = Collection(
            id=collection_id,
            user_id=user_id,
            name=name,
            description=description,
        )
        self.db.add(coll)
        self.db.commit()
        return collection_id

    def get_collections(self, user_id: Optional[int] = None) -> List[Dict]:
        """List all collections for a user"""
        user_id = user_id or self.user_id
        if user_id is None:
            raise ValueError("user_id must be provided")

        rows = self.db.query(Collection).filter(
            Collection.user_id == user_id
        ).order_by(Collection.created_at.desc()).all()

        return [
            {
                "id": r.id,
                "name": r.name,
                "description": r.description or "",
                "created_at": r.created_at.isoformat() if r.created_at else "",
            }
            for r in rows
        ]

    def delete_collection(self, collection_id: str, user_id: Optional[int] = None) -> bool:
        """Delete a collection (contents remain, just unlinked)"""
        user_id = user_id or self.user_id
        if user_id is None:
            raise ValueError("user_id must be provided")

        deleted = self.db.query(Collection).filter(
            Collection.id == collection_id,
            Collection.user_id == user_id,
        ).delete()
        self.db.commit()
        return deleted > 0

    def add_to_collection(self, content_id: str, collection_id: str, user_id: Optional[int] = None) -> bool:
        """Add content to a collection"""
        user_id = user_id or self.user_id
        if user_id is None:
            raise ValueError("user_id must be provided")

        vec = self.db.query(ContentVector).filter(
            ContentVector.id == content_id,
            ContentVector.user_id == user_id,
        ).first()
        if not vec:
            return False

        cols = vec.collections or []
        if collection_id not in cols:
            cols.append(collection_id)
            vec.collections = cols
            # Force SQLAlchemy to detect the change on a mutable JSON field
            from sqlalchemy.orm.attributes import flag_modified
            flag_modified(vec, "collections")
            self.db.commit()
        return True

    def remove_from_collection(self, content_id: str, collection_id: str, user_id: Optional[int] = None) -> bool:
        """Remove content from a collection"""
        user_id = user_id or self.user_id
        if user_id is None:
            raise ValueError("user_id must be provided")

        vec = self.db.query(ContentVector).filter(
            ContentVector.id == content_id,
            ContentVector.user_id == user_id,
        ).first()
        if not vec:
            return False

        cols = vec.collections or []
        if collection_id in cols:
            cols.remove(collection_id)
            vec.collections = cols
            from sqlalchemy.orm.attributes import flag_modified
            flag_modified(vec, "collections")
            self.db.commit()
            return True
        return False

    def get_collection_contents(self, collection_id: str, user_id: Optional[int] = None, full: bool = False) -> List[Dict]:
        """Get all content in a collection

        Args:
            collection_id: Collection ID
            user_id: User ID
            full: If True, return full_content dicts (for chat context)
        """
        user_id = user_id or self.user_id
        if user_id is None:
            raise ValueError("user_id must be provided")

        if full:
            # Need full_content for chat context — but not embedding/searchable_text (already deferred)
            vectors = self.db.query(ContentVector).filter(
                ContentVector.user_id == user_id
            ).all()
            return [v.full_content for v in vectors if collection_id in (v.collections or [])]
        else:
            # Only need lightweight metadata columns
            rows = self.db.query(
                ContentVector.id, ContentVector.title, ContentVector.summary,
                ContentVector.content_type, ContentVector.tags, ContentVector.topics,
                ContentVector.collections
            ).filter(
                ContentVector.user_id == user_id
            ).all()
            return [
                {
                    "id": r.id,
                    "title": r.title or "Untitled",
                    "summary": r.summary or "",
                    "content_type": r.content_type or "video",
                    "tags": r.tags or [],
                    "topics": r.topics or [],
                }
                for r in rows if collection_id in (r.collections or [])
            ]
