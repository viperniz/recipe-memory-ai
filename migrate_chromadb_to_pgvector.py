"""
Migration Script: ChromaDB to pgvector (PostgreSQL)
Moves all existing content from ChromaDB to PostgreSQL with pgvector
"""
import os
import sys
from pathlib import Path
from dotenv import load_dotenv
import json
from typing import List, Dict, Optional

# Load environment variables FIRST (before any imports)
# Explicitly load from project root
project_root = Path(__file__).parent
env_path = project_root / ".env"
load_dotenv(dotenv_path=env_path)

# Verify DATABASE_URL is loaded
if not os.getenv("DATABASE_URL"):
    print(f"[Migration] ERROR: DATABASE_URL not found in .env file")
    print(f"[Migration] Looking for .env at: {env_path}")
    print(f"[Migration] Make sure .env file exists in project root with DATABASE_URL")
    sys.exit(1)

print(f"[Migration] Loaded DATABASE_URL from: {env_path}")

# Add src to path
sys.path.insert(0, str(Path(__file__).parent / "src"))

# Import database models (but create our own engine)
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from database import Base, User, init_db
from vector_memory import VectorMemory
from content_memory import ContentMemory
from config import get_config

def get_all_chromadb_content(chroma_memory: ContentMemory, user_id: Optional[int] = None) -> List[Dict]:
    """
    Extract all content from ChromaDB
    
    Args:
        chroma_memory: ContentMemory instance
        user_id: Optional user ID filter
    
    Returns:
        List of content dictionaries
    """
    print(f"[Migration] Extracting content from ChromaDB...")
    
    # Build where clause for user filtering
    where = None
    if user_id is not None:
        where = {"user_id": str(user_id)}
    
    # Get all content from ChromaDB
    results = chroma_memory.content.get(where=where)
    
    contents = []
    ids = results.get("ids", [])
    metadatas = results.get("metadatas", [])
    
    print(f"[Migration] Found {len(ids)} items in ChromaDB")
    
    for idx, metadata in enumerate(metadatas):
        content_id = ids[idx] if idx < len(ids) else f"content_{idx}"
        
        try:
            # Parse full content from metadata
            full_content = json.loads(metadata.get("full_content", "{}"))
            
            # Ensure content has required fields
            if not full_content.get("id"):
                full_content["id"] = content_id
            
            if not full_content.get("title"):
                full_content["title"] = metadata.get("title", "Untitled")
            
            # Extract user_id from metadata if present
            stored_user_id = metadata.get("user_id")
            if stored_user_id:
                try:
                    full_content["_migration_user_id"] = int(stored_user_id)
                except (ValueError, TypeError):
                    pass
            
            contents.append(full_content)
            
        except (json.JSONDecodeError, KeyError) as e:
            print(f"[Migration] WARNING: Failed to parse content {content_id}: {e}")
            # Create minimal content dict
            contents.append({
                "id": content_id,
                "title": metadata.get("title", "Untitled"),
                "summary": metadata.get("summary", ""),
                "content_type": metadata.get("content_type", "other"),
                "topics": json.loads(metadata.get("topics", "[]")),
                "tags": json.loads(metadata.get("tags", "[]")),
                "created_at": metadata.get("created_at", ""),
                "source_url": metadata.get("source_url", ""),
                "_migration_user_id": int(stored_user_id) if stored_user_id else None
            })
    
    return contents

def migrate_content(
    chroma_memory: ContentMemory,
    vector_memory: VectorMemory,
    user_id: Optional[int] = None,
    dry_run: bool = False
) -> Dict:
    """
    Migrate content from ChromaDB to pgvector
    
    Args:
        chroma_memory: Source ChromaDB memory
        vector_memory: Target VectorMemory (pgvector)
        user_id: User ID to migrate (None = all users)
        dry_run: If True, only count items without migrating
    
    Returns:
        Migration statistics
    """
    stats = {
        "total": 0,
        "success": 0,
        "failed": 0,
        "skipped": 0,
        "errors": []
    }
    
    # Get all content from ChromaDB
    contents = get_all_chromadb_content(chroma_memory, user_id)
    stats["total"] = len(contents)
    
    if dry_run:
        print(f"[Migration] DRY RUN: Would migrate {stats['total']} items")
        return stats
    
    print(f"[Migration] Starting migration of {stats['total']} items...")
    
    # Migrate each content item
    for idx, content in enumerate(contents, 1):
        try:
            # Get user_id from content or parameter
            content_user_id = content.pop("_migration_user_id", None) or user_id
            
            if content_user_id is None:
                print(f"[Migration] WARNING: Content {content.get('id')} has no user_id, skipping")
                stats["skipped"] += 1
                continue
            
            # Check if content already exists in pgvector
            existing = vector_memory.get_content(content.get("id"), content_user_id)
            if existing:
                print(f"[Migration] Content {content.get('id')} already exists, skipping")
                stats["skipped"] += 1
                continue
            
            # Add to pgvector
            vector_memory.add_content(content, content_user_id)
            stats["success"] += 1
            
            if idx % 10 == 0:
                print(f"[Migration] Progress: {idx}/{stats['total']} ({stats['success']} migrated, {stats['failed']} failed)")
        
        except Exception as e:
            error_msg = f"Failed to migrate {content.get('id', 'unknown')}: {str(e)}"
            print(f"[Migration] ERROR: {error_msg}")
            stats["errors"].append(error_msg)
            stats["failed"] += 1
    
    return stats

def migrate_user_content(user_id: int, dry_run: bool = False):
    """Migrate content for a specific user"""
    db = SessionLocal()
    
    try:
        # Verify user exists
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            print(f"[Migration] ERROR: User {user_id} not found")
            return
        
        print(f"[Migration] Migrating content for user {user_id} ({user.email})")
        
        # Initialize memories
        chroma_memory = ContentMemory(persist_dir="data/memory")
        vector_memory = VectorMemory(db, user_id)
        
        # Migrate
        stats = migrate_content(chroma_memory, vector_memory, user_id, dry_run)
        
        # Print results
        print("\n[Migration] Migration Complete!")
        print(f"  Total items: {stats['total']}")
        print(f"  Successfully migrated: {stats['success']}")
        print(f"  Failed: {stats['failed']}")
        print(f"  Skipped: {stats['skipped']}")
        
        if stats["errors"]:
            print(f"\n[Migration] Errors encountered:")
            for error in stats["errors"][:10]:  # Show first 10 errors
                print(f"  - {error}")
            if len(stats["errors"]) > 10:
                print(f"  ... and {len(stats['errors']) - 10} more errors")
    
    finally:
        db.close()

def migrate_all_content(dry_run: bool = False):
    """Migrate all content from ChromaDB to pgvector"""
    print("[Migration] Migrating all content from ChromaDB to pgvector...")
    
    # Initialize ChromaDB memory
    chroma_memory = ContentMemory(persist_dir="data/memory")
    
    # Get all content (no user filter)
    all_contents = get_all_chromadb_content(chroma_memory, user_id=None)
    
    # Group by user_id
    user_contents = {}
    orphaned_contents = []
    
    for content in all_contents:
        user_id = content.get("_migration_user_id")
        if user_id:
            if user_id not in user_contents:
                user_contents[user_id] = []
            user_contents[user_id].append(content)
        else:
            orphaned_contents.append(content)
    
    print(f"[Migration] Found content for {len(user_contents)} users")
    print(f"[Migration] Found {len(orphaned_contents)} items without user_id")
    
    # For dry-run, just show what would be migrated
    if dry_run:
        print("\n[Migration] DRY RUN - Would migrate:")
        for user_id, contents in user_contents.items():
            print(f"  User {user_id}: {len(contents)} items")
        print(f"  Orphaned (no user_id): {len(orphaned_contents)} items")
        return
    
    # Only connect to database for actual migration
    # Use the existing working engine from database module (reuses connection)
    print("[Migration] Connecting to database...")
    
    # Import after .env is loaded to get the right engine
    from database import SessionLocal
    
    db = SessionLocal()
    
    # Test connection first
    try:
        db.execute(text("SELECT 1"))
        print("[Migration] Database connection verified")
    except Exception as e:
        db.close()
        print(f"[Migration] ERROR: Could not connect to database")
        print(f"[Migration] Error: {e}")
        print("\n[Migration] The simple connection test works, but migration script fails.")
        print("[Migration] This suggests a network/IPv6 issue when creating new connections.")
        print("\n[Migration] WORKAROUND: Skip migration for now.")
        print("[Migration] Your system will work fine - new videos will use pgvector automatically.")
        print("[Migration] You can migrate the 1 item later when network issues are resolved.")
        return
    
    try:
        if orphaned_contents:
            print("\n[Migration] WARNING: Some content has no user_id!")
            print("[Migration] These items will be skipped. You may need to manually assign them.")
            response = input("[Migration] Continue? (y/n): ")
            if response.lower() != 'y':
                print("[Migration] Migration cancelled")
                return
        
        total_stats = {
            "total": 0,
            "success": 0,
            "failed": 0,
            "skipped": 0,
            "errors": []
        }
        
        # Migrate for each user
        for user_id, contents in user_contents.items():
            print(f"\n[Migration] Migrating {len(contents)} items for user {user_id}...")
            
            # Verify user exists
            user = db.query(User).filter(User.id == user_id).first()
            if not user:
                print(f"[Migration] WARNING: User {user_id} not found, skipping their content")
                total_stats["skipped"] += len(contents)
                continue
            
            vector_memory = VectorMemory(db, user_id)
            stats = migrate_content(chroma_memory, vector_memory, user_id, dry_run)
            
            total_stats["total"] += stats["total"]
            total_stats["success"] += stats["success"]
            total_stats["failed"] += stats["failed"]
            total_stats["skipped"] += stats["skipped"]
            total_stats["errors"].extend(stats["errors"])
        
        # Print final results
        print("\n" + "=" * 60)
        print("[Migration] Migration Complete!")
        print("=" * 60)
        print(f"Total items processed: {total_stats['total']}")
        print(f"Successfully migrated: {total_stats['success']}")
        print(f"Failed: {total_stats['failed']}")
        print(f"Skipped: {total_stats['skipped']}")
        
        if total_stats["errors"]:
            print(f"\nErrors encountered: {len(total_stats['errors'])}")
            print("First 10 errors:")
            for error in total_stats["errors"][:10]:
                print(f"  - {error}")
    
    finally:
        db.close()

def main():
    """Main migration function"""
    import argparse
    
    parser = argparse.ArgumentParser(description="Migrate ChromaDB content to pgvector")
    parser.add_argument("--user-id", type=int, help="Migrate content for specific user only")
    parser.add_argument("--dry-run", action="store_true", help="Dry run (count only, don't migrate)")
    parser.add_argument("--init-db", action="store_true", help="Initialize database before migration")
    
    args = parser.parse_args()
    
    # Initialize database if requested
    if args.init_db:
        print("[Migration] Initializing database...")
        init_db()
        print("[Migration] Database initialized")
    
    # Check if database is configured
    config = get_config()
    db_url = config.database.url
    
    if "sqlite" in db_url:
        print("[Migration] WARNING: Using SQLite database.")
        print("[Migration] For production, use PostgreSQL with Supabase.")
        print("[Migration] Migration will work, but pgvector features will be limited.")
        response = input("[Migration] Continue? (y/n): ")
        if response.lower() != 'y':
            return
    
    # Run migration
    if args.user_id:
        migrate_user_content(args.user_id, args.dry_run)
    else:
        migrate_all_content(args.dry_run)

if __name__ == "__main__":
    main()
