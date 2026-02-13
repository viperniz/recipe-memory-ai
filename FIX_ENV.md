# Fix Your .env File

## Remove `pgbouncer=true` Parameter

The `pgbouncer=true` parameter is invalid. Just use port 6543.

**Correct format:**
```env
DATABASE_URL="postgresql://postgres:GYAegaYWipurbftm@db.flhmppxqcrydvmxiiazn.supabase.co:6543/postgres?sslmode=require"
```

**NOT this (has invalid parameter):**
```env
DATABASE_URL="postgresql://postgres:GYAegaYWipurbftm@db.flhmppxqcrydvmxiiazn.supabase.co:6543/postgres?sslmode=require&pgbouncer=true"
```

## Update Steps

1. Open `.env` file
2. Find the `DATABASE_URL` line
3. Change `:5432` to `:6543`
4. Remove `&pgbouncer=true` if it exists
5. Keep `?sslmode=require`

## Then Test

```powershell
python -c "from src.database import SessionLocal; db=SessionLocal(); print('Connected!'); db.close()"
```
