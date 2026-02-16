"""
RQ Worker entry point — runs video processing jobs from the Redis queue.

Usage:
    python run_worker.py

The worker connects to the same Redis instance as the API server and picks up
jobs enqueued by the /api/videos and /api/videos/upload endpoints.
"""

import sys
from pathlib import Path

# Add src/ to path so worker.py can import sibling modules (database, billing, etc.)
sys.path.insert(0, str(Path(__file__).parent / "src"))

from config import init_config
init_config(validate=True, strict=False)

from redis_client import get_redis_client
from rq import Worker, Queue


if __name__ == "__main__":
    conn = get_redis_client()
    if conn is None:
        print("ERROR: Redis connection required for worker. Set REDIS_URL.")
        sys.exit(1)

    listen = ["default"]
    print(f"Starting RQ worker, listening on queues: {listen}")
    worker = Worker(
        [Queue(name, connection=conn) for name in listen],
        connection=conn,
    )
    worker.work()
