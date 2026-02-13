# Test Different SSL Modes

Since Supabase enforces SSL, we can't turn it off completely, but we can try different SSL modes.

## Option 1: Try `sslmode=prefer` (less strict)

```env
DATABASE_URL="postgresql://postgres:GYAegaYWipurbftm@db.flhmppxqcrydvmxiiazn.supabase.co:6543/postgres?sslmode=prefer"
```

## Option 2: Try without sslmode parameter (let it default)

```env
DATABASE_URL="postgresql://postgres:GYAegaYWipurbftm@db.flhmppxqcrydvmxiiazn.supabase.co:6543/postgres"
```

## Option 3: Try `sslmode=allow` (allows non-SSL fallback)

```env
DATABASE_URL="postgresql://postgres:GYAegaYWipurbftm@db.flhmppxqcrydvmxiiazn.supabase.co:6543/postgres?sslmode=allow"
```

## Test Each One

After updating `.env`, test:
```powershell
python -c "from src.database import SessionLocal; db=SessionLocal(); print('Connected!'); db.close()"
```

If connection works, try migration:
```powershell
python migrate_chromadb_to_pgvector.py --dry-run
```

## Note

Supabase enforces SSL, so `sslmode=require` should work. The issue might be:
- Port 6543 connection pooler configuration
- IPv6 vs IPv4 connection
- Network/firewall blocking

Try Option 2 first (no sslmode parameter) - it should default to SSL.
