"""
Quick test: add a video via API and confirm it is stored in pgvector (Supabase).
Run with API already running: python run_api.py (in another terminal).

Usage:
  set TEST_EMAIL=your@email.com
  set TEST_PASSWORD=yourpassword
  python test_pgvector_flow.py

Or pass video URL:
  python test_pgvector_flow.py "https://www.youtube.com/watch?v=SHORT_VIDEO_ID"

Uses a short public YouTube URL by default if none provided.
"""
import os
import sys
import time
import requests
from pathlib import Path

# Load .env from project root
_root = Path(__file__).resolve().parent
_env = _root / ".env"
if _env.exists():
    with open(_env) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, _, v = line.partition("=")
                k, v = k.strip(), v.strip().strip('"').strip("'")
                os.environ.setdefault(k, v)

API_BASE = os.environ.get("API_BASE", "http://127.0.0.1:8000")
TEST_EMAIL = os.environ.get("TEST_EMAIL", "")
TEST_PASSWORD = os.environ.get("TEST_PASSWORD", "")
# Short public video (e.g. YouTube 1 min clip) for quick test
DEFAULT_VIDEO = "https://www.youtube.com/watch?v=jNQXAC9IVRw"  # "Me at the zoo" ~19s


def main():
    email = TEST_EMAIL or input("Email: ").strip()
    password = TEST_PASSWORD or input("Password: ").strip()
    video_url = (sys.argv[1] if len(sys.argv) > 1 else None) or DEFAULT_VIDEO

    print(f"[Test] API base: {API_BASE}")
    print(f"[Test] Video URL: {video_url}")

    # 1) Login
    r = requests.post(
        f"{API_BASE}/api/auth/login",
        data={"username": email, "password": password},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        timeout=10,
    )
    if r.status_code != 200:
        print(f"[Test] Login failed: {r.status_code} - {r.text}")
        return 1
    token = r.json().get("access_token")
    if not token:
        print("[Test] No access_token in login response")
        return 1
    print("[Test] Login OK")

    headers = {"Authorization": f"Bearer {token}"}

    # 2) Library count before
    r = requests.get(f"{API_BASE}/api/library", headers=headers, timeout=10)
    if r.status_code != 200:
        print(f"[Test] GET /api/library failed: {r.status_code}")
        return 1
    before = r.json().get("contents", [])
    print(f"[Test] Library before: {len(before)} items")

    # 3) Add video
    r = requests.post(
        f"{API_BASE}/api/videos/add",
        json={
            "url_or_path": video_url,
            "analyze_frames": False,
            "provider": "openai",
            "whisper_model": "base",
        },
        headers={**headers, "Content-Type": "application/json"},
        timeout=10,
    )
    if r.status_code != 200:
        print(f"[Test] Add video failed: {r.status_code} - {r.text}")
        return 1
    data = r.json()
    job_id = data.get("job_id")
    print(f"[Test] Video queued, job_id={job_id}")

    # 4) Poll job until complete (or timeout)
    for _ in range(120):
        r = requests.get(f"{API_BASE}/api/jobs/{job_id}", headers=headers, timeout=10)
        if r.status_code != 200:
            print(f"[Test] GET job failed: {r.status_code}")
            time.sleep(2)
            continue
        job = r.json()
        status = job.get("status", "")
        progress = job.get("progress", 0)
        print(f"[Test] Job status: {status} ({progress}%)")
        if status == "completed":
            print("[Test] Job completed successfully.")
            break
        if status == "failed" or status == "cancelled":
            print(f"[Test] Job ended: {status} - {job.get('error', '')}")
            return 1
        time.sleep(3)
    else:
        print("[Test] Timeout waiting for job (check API logs)")
        return 1

    # 5) Library after
    r = requests.get(f"{API_BASE}/api/library", headers=headers, timeout=10)
    if r.status_code != 200:
        print(f"[Test] GET /api/library after failed: {r.status_code}")
        return 1
    after = r.json().get("contents", [])
    print(f"[Test] Library after: {len(after)} items")

    if len(after) > len(before):
        print("[Test] SUCCESS: New content is in the library (pgvector).")
        return 0
    print("[Test] Library count did not increase; check API and DB.")
    return 1


if __name__ == "__main__":
    sys.exit(main())
