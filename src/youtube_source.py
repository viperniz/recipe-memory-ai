"""
YouTube Source — Transcript-only fallback when yt-dlp download fails.

Used when the user clicks "Process Without Vision" after a youtube_blocked error.
Fetches transcript via youtube-transcript-api and metadata via InnerTube API.
"""

import base64
import re
from typing import Optional

import requests
from youtube_transcript_api import YouTubeTranscriptApi
from youtube_transcript_api._errors import (
    TranscriptsDisabled,
    NoTranscriptFound,
    VideoUnavailable,
)


class YouTubeTranscriptUnavailable(Exception):
    """Raised when no transcript can be fetched for a YouTube video."""
    pass


def _extract_video_id(url: str) -> str:
    """Extract video ID from a YouTube URL."""
    if "v=" in url:
        return url.split("v=")[1].split("&")[0]
    elif "youtu.be/" in url:
        return url.split("youtu.be/")[1].split("?")[0]
    # Already a bare ID
    if re.match(r'^[\w-]{11}$', url):
        return url
    raise ValueError(f"Cannot extract video ID from: {url}")


def fetch_youtube_transcript(video_id: str, languages: list[str] | None = None) -> dict:
    """Fetch YouTube captions via youtube-transcript-api.

    Returns a dict matching the format of Transcriber.transcribe():
        {"text": str, "segments": [{"start", "end", "text"}], "language": str}
    """
    try:
        ytt_api = YouTubeTranscriptApi()
        if languages:
            transcript = ytt_api.fetch(video_id, languages=languages)
        else:
            transcript = ytt_api.fetch(video_id)
    except (TranscriptsDisabled, NoTranscriptFound, VideoUnavailable) as e:
        raise YouTubeTranscriptUnavailable(
            f"No transcript available for video {video_id}: {e}"
        )

    # Convert to Whisper-compatible format
    segments = []
    full_text_parts = []
    for entry in transcript.snippets:
        seg = {
            "start": entry.start,
            "end": entry.start + entry.duration,
            "text": entry.text,
        }
        segments.append(seg)
        full_text_parts.append(entry.text)

    detected_language = transcript.language_code if hasattr(transcript, 'language_code') else "en"

    return {
        "text": " ".join(full_text_parts),
        "segments": segments,
        "language": detected_language,
    }


def fetch_youtube_metadata(video_id: str) -> dict:
    """Fetch video metadata via YouTube's InnerTube API (no auth needed).

    Returns a dict matching the format of download_audio_with_metadata() meta:
        {"duration", "title", "view_count", "uploader", "upload_date", ...}
    """
    # InnerTube player endpoint (public, no API key needed)
    url = "https://www.youtube.com/youtubei/v1/player"
    payload = {
        "videoId": video_id,
        "context": {
            "client": {
                "clientName": "WEB",
                "clientVersion": "2.20240101.00.00",
            }
        },
    }

    try:
        resp = requests.post(url, json=payload, timeout=10)
        resp.raise_for_status()
        data = resp.json()
    except Exception as e:
        print(f"[youtube_source] InnerTube metadata fetch failed: {e}")
        return {"duration": 0, "title": f"YouTube Video ({video_id})", "id": video_id}

    video_details = data.get("videoDetails", {})
    microformat = data.get("microformat", {}).get("playerMicroformatRenderer", {})

    duration_sec = int(video_details.get("lengthSeconds", 0))
    view_count = int(video_details.get("viewCount", 0))

    return {
        "duration": duration_sec,
        "title": video_details.get("title", f"YouTube Video ({video_id})"),
        "view_count": view_count,
        "like_count": 0,  # Not available via InnerTube player
        "comment_count": 0,
        "channel_follower_count": 0,
        "upload_date": microformat.get("uploadDate", "").replace("-", "")[:8],
        "uploader": video_details.get("author", ""),
        "categories": [microformat.get("category", "")] if microformat.get("category") else [],
        "description": (video_details.get("shortDescription") or "")[:500],
        "id": video_id,
    }


def fetch_youtube_thumbnails(video_id: str) -> list[dict]:
    """Fetch standard YouTube thumbnails as base64 for UI display.

    Returns list of {"timestamp": 0, "filename": str, "base64": str} dicts.
    """
    # Standard YouTube thumbnail URLs (always available)
    thumb_urls = [
        f"https://img.youtube.com/vi/{video_id}/maxresdefault.jpg",
        f"https://img.youtube.com/vi/{video_id}/0.jpg",
        f"https://img.youtube.com/vi/{video_id}/1.jpg",
        f"https://img.youtube.com/vi/{video_id}/2.jpg",
        f"https://img.youtube.com/vi/{video_id}/3.jpg",
    ]

    thumbnails = []
    for i, thumb_url in enumerate(thumb_urls):
        try:
            resp = requests.get(thumb_url, timeout=5)
            if resp.status_code == 200 and len(resp.content) > 1000:
                b64 = base64.b64encode(resp.content).decode("utf-8")
                thumbnails.append({
                    "timestamp": 0,
                    "filename": f"thumb_{i}.jpg",
                    "base64": b64,
                })
        except Exception:
            continue

    return thumbnails
