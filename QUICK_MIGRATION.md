# Quick Migration Fix

## Update Your .env File

Change port from **5432** to **6543** (connection pooler):

**Current:**
```env
DATABASE_URL="postgresql://postgres:GYAegaYWipurbftm@db.flhmppxqcrydvmxiiazn.supabase.co:5432/postgres?sslmode=require"
```

**Updated (use this):**
```env
DATABASE_URL="postgresql://postgres:GYAegaYWipurbftm@db.flhmppxqcrydvmxiiazn.supabase.co:6543/postgres?sslmode=require&pgbouncer=true"
```

## Then Run Migration

```powershell
python migrate_chromadb_to_pgvector.py --dry-run
```

If dry-run works:
```powershell
python migrate_chromadb_to_pgvector.py
```

## Why Port 6543?

Supabase uses **connection pooling** which requires port **6543** instead of direct connection port **5432**. The pooler handles multiple connections better and avoids timeouts.
