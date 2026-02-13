"""
Redis Client for Job Queue and Caching
Supports both regular (redis://) and SSL (rediss://) connections
"""
import redis
import json
from typing import Optional, Dict, Any
from urllib.parse import urlparse
from config import get_config

_config = None
_redis_client = None

def get_redis_client() -> Optional[redis.Redis]:
    """Get or create Redis client (singleton) with SSL support"""
    global _redis_client, _config
    
    if _redis_client is None:
        config = get_config()
        redis_url = config.redis.url
        
        if not redis_url or redis_url == "redis://localhost:6379/0":
            print("[Redis] Redis URL not configured, caching disabled")
            return None
        
        # Parse URL to check if SSL is needed
        parsed = urlparse(redis_url)
        use_ssl = parsed.scheme == "rediss"
        
        # Remove 'rediss://' and use 'redis://' for connection, but enable SSL
        if use_ssl:
            # Replace rediss:// with redis:// for connection
            connection_url = redis_url.replace("rediss://", "redis://")
        else:
            connection_url = redis_url
        
        try:
            # For rediss://, redis.from_url automatically detects SSL
            # Just pass the URL as-is, it handles SSL automatically
            _redis_client = redis.from_url(
                redis_url,  # Use original URL, redis handles rediss:// automatically
                decode_responses=True,  # Auto-decode strings
                socket_connect_timeout=5,
                socket_timeout=5,
                retry_on_timeout=True,
            )
            # Test connection
            _redis_client.ping()
            print(f"[Redis] Connected to Redis ({'SSL' if use_ssl else 'non-SSL'})")
        except redis.ConnectionError as e:
            print(f"[Redis] WARNING: Could not connect to Redis: {e}")
            print("[Redis] Job queue and caching will be disabled")
            _redis_client = None
        except Exception as e:
            print(f"[Redis] ERROR: {e}")
            _redis_client = None
    
    return _redis_client

def cache_set(key: str, value: Any, ttl: int = 3600) -> bool:
    """Set a cache value with TTL (default 1 hour)"""
    client = get_redis_client()
    if not client:
        return False
    
    try:
        if isinstance(value, (dict, list)):
            value = json.dumps(value)
        return client.setex(key, ttl, value)
    except Exception as e:
        print(f"[Redis] Cache set error: {e}")
        return False

def cache_get(key: str) -> Optional[Any]:
    """Get a cached value"""
    client = get_redis_client()
    if not client:
        return None
    
    try:
        value = client.get(key)
        if value is None:
            return None
        
        # Try to parse as JSON, fallback to string
        try:
            return json.loads(value)
        except (json.JSONDecodeError, TypeError):
            return value
    except Exception as e:
        print(f"[Redis] Cache get error: {e}")
        return None

def cache_delete(key: str) -> bool:
    """Delete a cached value"""
    client = get_redis_client()
    if not client:
        return False
    
    try:
        return bool(client.delete(key))
    except Exception as e:
        print(f"[Redis] Cache delete error: {e}")
        return False

def cache_delete_pattern(pattern: str) -> int:
    """Delete all keys matching pattern"""
    client = get_redis_client()
    if not client:
        return 0
    
    try:
        keys = client.keys(pattern)
        if keys:
            return client.delete(*keys)
        return 0
    except Exception as e:
        print(f"[Redis] Cache delete pattern error: {e}")
        return 0
