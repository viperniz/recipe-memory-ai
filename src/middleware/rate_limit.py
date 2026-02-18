"""
Rate Limiting Middleware for Video Memory AI
Configurable per-user and per-IP rate limits
"""

import time
import asyncio
from collections import defaultdict
from dataclasses import dataclass
from typing import Dict, Optional, Tuple
from fastapi import Request, HTTPException
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse


@dataclass
class RateLimitConfig:
    """Configuration for rate limiting"""
    # Requests per minute for authenticated users
    auth_requests_per_minute: int = 100
    # Requests per minute for unauthenticated users (per IP)
    unauth_requests_per_minute: int = 20
    # Special limits for expensive operations (per hour)
    video_processing_per_hour: int = 10
    # Cleanup interval in seconds
    cleanup_interval: int = 60


class RateLimiter:
    """In-memory rate limiter with sliding window"""

    def __init__(self, config: Optional[RateLimitConfig] = None):
        self.config = config or RateLimitConfig()
        # request_counts[key] = list of timestamps
        self.request_counts: Dict[str, list] = defaultdict(list)
        # video_processing_counts[user_id] = list of timestamps
        self.video_processing_counts: Dict[str, list] = defaultdict(list)
        self._last_cleanup = time.time()

    def _cleanup_old_entries(self):
        """Remove entries older than the window"""
        now = time.time()
        if now - self._last_cleanup < self.config.cleanup_interval:
            return

        # Clean up request counts (older than 1 minute)
        for key in list(self.request_counts.keys()):
            self.request_counts[key] = [
                ts for ts in self.request_counts[key]
                if now - ts < 60
            ]
            if not self.request_counts[key]:
                del self.request_counts[key]

        # Clean up video processing counts (older than 1 hour)
        for key in list(self.video_processing_counts.keys()):
            self.video_processing_counts[key] = [
                ts for ts in self.video_processing_counts[key]
                if now - ts < 3600
            ]
            if not self.video_processing_counts[key]:
                del self.video_processing_counts[key]

        self._last_cleanup = now

    def check_rate_limit(
        self,
        key: str,
        is_authenticated: bool,
        is_video_processing: bool = False
    ) -> Tuple[bool, int, int]:
        """
        Check if request should be rate limited.

        Returns:
            Tuple of (allowed, remaining_requests, reset_time_seconds)
        """
        now = time.time()
        self._cleanup_old_entries()

        # Check video processing limit separately
        if is_video_processing and is_authenticated:
            user_key = f"video:{key}"
            timestamps = self.video_processing_counts[user_key]
            # Filter to last hour
            timestamps = [ts for ts in timestamps if now - ts < 3600]
            self.video_processing_counts[user_key] = timestamps

            limit = self.config.video_processing_per_hour
            if len(timestamps) >= limit:
                oldest = min(timestamps) if timestamps else now
                reset_time = int(3600 - (now - oldest))
                return False, 0, reset_time

            # Allow and record
            self.video_processing_counts[user_key].append(now)
            remaining = limit - len(timestamps) - 1
            return True, remaining, 3600

        # Regular request rate limiting
        timestamps = self.request_counts[key]
        # Filter to last minute
        timestamps = [ts for ts in timestamps if now - ts < 60]
        self.request_counts[key] = timestamps

        limit = (
            self.config.auth_requests_per_minute
            if is_authenticated
            else self.config.unauth_requests_per_minute
        )

        if len(timestamps) >= limit:
            oldest = min(timestamps) if timestamps else now
            reset_time = int(60 - (now - oldest))
            return False, 0, reset_time

        # Allow and record
        self.request_counts[key].append(now)
        remaining = limit - len(timestamps) - 1
        return True, remaining, 60

    def get_stats(self) -> dict:
        """Get current rate limiter statistics"""
        return {
            "active_keys": len(self.request_counts),
            "active_video_keys": len(self.video_processing_counts),
            "total_tracked_requests": sum(len(v) for v in self.request_counts.values()),
            "total_video_requests": sum(len(v) for v in self.video_processing_counts.values()),
        }


# Global rate limiter instance
rate_limiter = RateLimiter()


class RateLimitMiddleware(BaseHTTPMiddleware):
    """FastAPI middleware for rate limiting"""

    # Paths that should have video processing limits
    VIDEO_PROCESSING_PATHS = [
        "/api/videos/add",
        "/api/videos/add-from-search",
    ]

    # Paths exempt from rate limiting
    EXEMPT_PATHS = [
        "/api/health",
        "/api/thumbnails/",
        "/docs",
        "/openapi.json",
        "/redoc",
    ]

    async def dispatch(self, request: Request, call_next):
        # Skip rate limiting for CORS preflight requests
        if request.method == "OPTIONS":
            return await call_next(request)

        # Skip rate limiting for exempt paths
        path = request.url.path
        if any(path.startswith(exempt) for exempt in self.EXEMPT_PATHS):
            return await call_next(request)

        # Get client identifier
        client_ip = self._get_client_ip(request)

        # Check if authenticated (look for Authorization header)
        auth_header = request.headers.get("Authorization", "")
        is_authenticated = auth_header.startswith("Bearer ")

        # Use user ID from token if authenticated, otherwise IP
        if is_authenticated:
            # We'll use the token as key (simplified - in production decode token)
            key = f"auth:{auth_header[7:20]}"  # Use first 13 chars of token
        else:
            key = f"ip:{client_ip}"

        # Check if this is a video processing request
        is_video_processing = any(
            path.startswith(vp) for vp in self.VIDEO_PROCESSING_PATHS
        )

        # Check rate limit
        allowed, remaining, reset_time = rate_limiter.check_rate_limit(
            key, is_authenticated, is_video_processing
        )

        if not allowed:
            return JSONResponse(
                status_code=429,
                content={
                    "detail": "Rate limit exceeded. Please try again later.",
                    "retry_after": reset_time,
                },
                headers={
                    "X-RateLimit-Remaining": "0",
                    "X-RateLimit-Reset": str(reset_time),
                    "Retry-After": str(reset_time),
                }
            )

        # Process request
        response = await call_next(request)

        # Add rate limit headers
        response.headers["X-RateLimit-Remaining"] = str(remaining)
        response.headers["X-RateLimit-Reset"] = str(reset_time)

        return response

    def _get_client_ip(self, request: Request) -> str:
        """Extract client IP from request"""
        # Check for forwarded IP (behind proxy)
        forwarded = request.headers.get("X-Forwarded-For")
        if forwarded:
            return forwarded.split(",")[0].strip()

        real_ip = request.headers.get("X-Real-IP")
        if real_ip:
            return real_ip

        # Fallback to direct client
        return request.client.host if request.client else "unknown"
