"""Test video processing and saving to find the error"""
from src.app import VideoMemoryAI
from src.database import SessionLocal
from src.vector_memory import VectorMemory
from src.job_service import JobService

db = SessionLocal()

# Test 1: Create a job (this is what the API does first)
print("TEST 1: Creating job...")
try:
    job = JobService.create_job(
        db=db,
        user_id=1,
        video_url="https://www.youtube.com/watch?v=test",
        settings={"provider": "openai"},
        title="Test Job",
        mode="auto"
    )
    print(f"  Job created: {job.id}, mode: {job.mode}")
except Exception as e:
    import traceback
    print(f"  ERROR creating job: {e}")
    traceback.print_exc()

# Test 2: Save to VectorMemory (this is what the API does after processing)
print("\nTEST 2: Saving to VectorMemory...")
try:
    vector_memory = VectorMemory(db, user_id=1)
    test_content = {
        "id": "test_content_123",
        "title": "Test Content",
        "summary": "This is a test",
        "content_type": "video",
        "mode": "creator",
        "topics": ["test"],
        "tags": ["test"],
        "key_points": [],
        "entities": [],
        "transcript": "Test transcript",
        "recipe": None,
        "learn": None,
        "creator": {"title": "Test", "hook": "Test hook"},
        "meeting": None
    }
    content_id = vector_memory.add_content(test_content, user_id=1)
    print(f"  Content saved: {content_id}")
except Exception as e:
    import traceback
    print(f"  ERROR saving content: {e}")
    traceback.print_exc()

print("\nDone!")
