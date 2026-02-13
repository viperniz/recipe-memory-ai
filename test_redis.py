"""
Test Redis Connection
"""
import os
from dotenv import load_dotenv

load_dotenv()

redis_url = os.getenv("REDIS_URL")
if redis_url:
    print(f"Redis URL: {redis_url[:30]}...")  # Don't print full URL with password
else:
    print("REDIS_URL not set in .env")
    exit(1)

try:
    import redis
    from urllib.parse import urlparse
    
    # redis.from_url automatically handles rediss:// (SSL) URLs
    client = redis.from_url(
        redis_url,
        decode_responses=True,
        socket_connect_timeout=5,
        socket_timeout=5,
    )
    
    # Test connection
    client.ping()
    print("[SUCCESS] Redis connection successful!")
    
    # Test set/get
    client.set("test_key", "test_value", ex=10)
    value = client.get("test_key")
    print(f"[SUCCESS] Test set/get: {value}")
    
    # Clean up
    client.delete("test_key")
    print("[SUCCESS] Redis test completed successfully!")
    
except ImportError:
    print("[ERROR] redis package not installed. Install with: pip install redis>=5.0.0")
except Exception as e:
    print(f"[ERROR] Redis connection failed: {e}")
    import traceback
    traceback.print_exc()
