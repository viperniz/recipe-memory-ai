# Test pgvector (new videos → Supabase)

This confirms that **new videos** are stored in **pgvector** (Supabase), not ChromaDB.

## Prerequisites

- API running: `python run_api.py`
- `.env` has a valid `DATABASE_URL` (Supabase, port 6543 recommended)
- A user account (register in the app if needed)

## Option A: Test in the app (manual)

1. Open the app, log in.
2. **New Note** tab → paste a short YouTube URL (e.g. `https://www.youtube.com/watch?v=jNQXAC9IVRw`) → Add.
3. Wait for the job to finish (Processing queue / Jobs in sidebar).
4. Open **Library** — the new video should appear.
5. Click it: summary, transcript, etc. are loaded from **pgvector**.

If you see the new item in the library after processing, pgvector is working.

## Option B: Automated script

With the API already running in another terminal:

```powershell
# Optional: set credentials so the script doesn't prompt
$env:TEST_EMAIL = "your@email.com"
$env:TEST_PASSWORD = "yourpassword"
python test_pgvector_flow.py
```

Or pass a video URL:

```powershell
python test_pgvector_flow.py "https://www.youtube.com/watch?v=VIDEO_ID"
```

The script will:

1. Log in with your credentials
2. Count library items
3. Add one video to the queue
4. Poll the job until it completes
5. Count library again — count should increase by 1

**Success** = script prints `SUCCESS: New content is in the library (pgvector).`

## If something fails

- **Login failed** — check email/password; ensure `/api/auth/login` works (e.g. in browser or Postman).
- **Add video failed (403)** — tier limit; check billing/tier limits.
- **Job stays queued / timeout** — check API terminal for errors (e.g. DB connection, Whisper, OpenAI). DB timeouts from the migration script do not affect the running API if it already connected at startup.
- **Library empty or no new item** — ensure `DATABASE_URL` points to Supabase and API started with it; check API logs for exceptions when saving content.

## Summary

- **New content** → always goes to **pgvector** (Supabase) when you're logged in and the API uses `DATABASE_URL`.
- **Old ChromaDB content** → still in local ChromaDB until you run the migration (or re-add those videos). The migration script can be retried later (e.g. from another network) if you had timeouts.
