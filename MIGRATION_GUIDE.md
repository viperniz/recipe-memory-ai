# Migration Guide: ChromaDB to pgvector

This guide explains how to migrate your existing ChromaDB data to PostgreSQL with pgvector.

## Prerequisites

1. **PostgreSQL Database** (Supabase recommended)
   - Create a Supabase project
   - Get your connection string
   - Add to `.env`: `DATABASE_URL=postgresql://...`

2. **Dependencies Installed**
   ```bash
   pip install -r requirements.txt
   ```

3. **Database Initialized**
   ```bash
   python -c "from src.database import init_db; init_db()"
   ```

## Migration Steps

### Step 1: Dry Run (Recommended)

Test the migration without making changes:

```bash
python migrate_chromadb_to_pgvector.py --dry-run
```

This will:
- Count all items in ChromaDB
- Show what would be migrated
- **Not make any changes**

### Step 2: Migrate All Content

Migrate all content from ChromaDB to pgvector:

```bash
python migrate_chromadb_to_pgvector.py
```

This will:
- Extract all content from ChromaDB
- Group by user_id
- Migrate to PostgreSQL with pgvector
- Show progress and statistics

### Step 3: Migrate Specific User

Migrate content for a specific user only:

```bash
python migrate_chromadb_to_pgvector.py --user-id 1
```

Replace `1` with the actual user ID.

### Step 4: Initialize Database First

If you haven't initialized the database yet:

```bash
python migrate_chromadb_to_pgvector.py --init-db
```

## Migration Process

The migration script:

1. **Reads from ChromaDB**
   - Extracts all content from `data/memory/` directory
   - Parses metadata and full content
   - Preserves user_id associations

2. **Converts to pgvector format**
   - Generates embeddings using sentence-transformers
   - Stores in PostgreSQL `content_vectors` table
   - Maintains all metadata and relationships

3. **Handles Edge Cases**
   - Skips content that already exists (idempotent)
   - Handles content without user_id
   - Reports errors without stopping

## What Gets Migrated

- ✅ All content (title, summary, transcript, etc.)
- ✅ Metadata (topics, tags, entities)
- ✅ User associations
- ✅ Timestamps and source URLs
- ✅ Full content JSON

## What Doesn't Get Migrated

- ❌ ChromaDB collections (user-created collections)
  - These would need manual recreation
- ❌ ChromaDB indexes
  - pgvector uses different indexing

## After Migration

1. **Verify Migration**
   ```bash
   # Check content count in database
   python -c "from src.database import SessionLocal, ContentVector; db = SessionLocal(); print(f'Total: {db.query(ContentVector).count()}')"
   ```

2. **Test Search**
   - Use the API to search for migrated content
   - Verify results match ChromaDB

3. **Backup ChromaDB** (Optional)
   ```bash
   # Keep ChromaDB data as backup
   cp -r data/memory data/memory_backup
   ```

4. **Switch to pgvector** (When ready)
   - Set `USE_PGVECTOR=true` in `.env`
   - Restart API server
   - New content will use pgvector automatically

## Troubleshooting

### "User not found" errors
- Content without user_id will be skipped
- Manually assign user_id if needed

### "Content already exists" warnings
- Migration is idempotent - safe to run multiple times
- Existing content won't be overwritten

### Database connection errors
- Check `DATABASE_URL` in `.env`
- Verify PostgreSQL is accessible
- Check pgvector extension is enabled

### Memory errors
- Large migrations may use significant memory
- Process in batches using `--user-id` flag

## Rollback

If you need to rollback:

1. **Keep ChromaDB data** (don't delete `data/memory/`)
2. **Remove pgvector data**:
   ```sql
   DELETE FROM content_vectors;
   DELETE FROM entity_vectors;
   ```
3. **Switch back to ChromaDB**:
   - Remove `USE_PGVECTOR=true` from `.env`
   - Restart API server

## Performance

- **Speed**: ~10-50 items/second (depends on content size)
- **Memory**: ~500MB-2GB (depends on content count)
- **Time**: ~1-5 minutes per 1000 items

## Support

If you encounter issues:
1. Run with `--dry-run` first
2. Check error messages in output
3. Verify database connection
4. Check user IDs exist in database
