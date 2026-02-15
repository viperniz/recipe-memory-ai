"""
Video Processing Module
Extracts audio and key frames from cooking videos
"""

import cv2
import os
import sys
import base64
from pathlib import Path
from typing import List, Tuple
import subprocess


def _find_conda_executable(name: str, subdir: str = "Library/bin") -> str:
    """Find an executable, preferring full system builds over conda-bundled ones."""
    ext = ".exe" if sys.platform == "win32" else ""

    # On Windows, prefer winget/system installs (full builds, newer) over conda
    if sys.platform == "win32":
        import glob as _glob
        winget_pattern = os.path.join(
            os.environ.get("LOCALAPPDATA", ""),
            "Microsoft", "WinGet", "Packages",
            f"*FFmpeg*", "**", f"{name}{ext}"
        )
        matches = _glob.glob(winget_pattern, recursive=True)
        if matches:
            return matches[0]

    # Conda environment candidates (fallback)
    candidates = []
    conda_prefix = os.environ.get("CONDA_PREFIX")
    if conda_prefix:
        if sys.platform == "win32":
            candidates.append(Path(conda_prefix) / subdir / f"{name}{ext}")
            candidates.append(Path(conda_prefix) / "Scripts" / f"{name}{ext}")
        else:
            candidates.append(Path(conda_prefix) / "bin" / f"{name}{ext}")

    if sys.platform == "win32":
        user = os.environ.get("USERPROFILE", "")
        for base in ["miniconda3", "anaconda3"]:
            candidates.append(Path(user) / base / "envs" / "recipe-ai" / subdir / f"{name}{ext}")
            candidates.append(Path(user) / base / "envs" / "recipe-ai" / "Scripts" / f"{name}{ext}")
            candidates.append(Path(user) / base / "Library" / "bin" / f"{name}{ext}")

    for p in candidates:
        if p.exists():
            return str(p)

    # Fall back to PATH
    return name


def get_ffmpeg_path() -> str:
    """Find ffmpeg executable, checking conda environment first"""
    return _find_conda_executable("ffmpeg")


def get_ytdlp_path() -> str:
    """Find yt-dlp executable, checking conda environment first"""
    return _find_conda_executable("yt-dlp", subdir="Scripts")


def _extract_video_id(url: str) -> str | None:
    """Extract video ID from a YouTube URL."""
    if 'youtube.com' in url or 'youtu.be' in url:
        if 'v=' in url:
            return url.split('v=')[1].split('&')[0]
        elif 'youtu.be/' in url:
            return url.split('youtu.be/')[1].split('?')[0]
    return None


def download_video(url: str, output_dir: str = "data/videos") -> str:
    """Download video from YouTube or other platforms using yt-dlp"""
    os.makedirs(output_dir, exist_ok=True)

    # Use video ID as primary filename to avoid non-ASCII path issues
    output_template = os.path.join(output_dir, "%(id)s.%(ext)s")

    # Check if already downloaded (skip redundant yt-dlp calls)
    video_id = _extract_video_id(url)
    if video_id:
        for ext in ['*.mp4', '*.webm', '*.mkv']:
            files = [f for f in Path(output_dir).glob(ext) if video_id in f.stem]
            if files:
                cached = str(max(files, key=os.path.getmtime))
                print(f"  Video already downloaded: {cached}")
                return cached

    ytdlp = get_ytdlp_path()

    # Download (--print filename gives us the path in a single call)
    download_cmd = [
        ytdlp,
        "-f", "best[height<=720]",
        "-o", output_template,
        "--no-playlist",
        "--print", "after_move:filepath",
        url
    ]

    result = subprocess.run(download_cmd, capture_output=True, text=True, encoding="utf-8", errors="replace")

    if result.returncode != 0:
        raise Exception(f"Failed to download video: {result.stderr}")

    # --print after_move:filepath prints the final path as the last line of stdout
    printed_path = result.stdout.strip().split('\n')[-1].strip() if result.stdout.strip() else None
    if printed_path and Path(printed_path).exists():
        return printed_path

    # Parse output for the actual downloaded file
    for line in result.stdout.split('\n'):
        if '[download] Destination:' in line:
            path = line.split('Destination:', 1)[1].strip()
            if Path(path).exists():
                return path
        if 'has already been downloaded' in line:
            path = line.split('] ', 1)[1].replace(' has already been downloaded', '').strip()
            if Path(path).exists():
                return path
        if '[Merger] Merging formats into' in line:
            path = line.split('into "', 1)[1].rstrip('"').strip()
            if Path(path).exists():
                return path

    # Fallback: find most recent file with the video ID in the name
    if video_id:
        for ext in ['*.mp4', '*.webm', '*.mkv']:
            files = [f for f in Path(output_dir).glob(ext) if video_id in str(f)]
            if files:
                return str(max(files, key=os.path.getmtime))

    # Final fallback: most recent video file
    for ext in ['*.mp4', '*.webm', '*.mkv']:
        files = list(Path(output_dir).glob(ext))
        if files:
            return str(max(files, key=os.path.getmtime))

    raise Exception("Could not find downloaded video")


def extract_audio(video_path: str, output_path: str = None) -> str:
    """Extract audio from video file for transcription.

    Uses AAC in an m4a container (built-in ffmpeg encoder, no external libs needed).
    The OpenAI Whisper API accepts m4a, mp3, mp4, wav, and webm.
    """
    if output_path is None:
        output_path = video_path.rsplit('.', 1)[0] + '.m4a'

    ffmpeg_path = get_ffmpeg_path()
    print(f"Using ffmpeg: {ffmpeg_path}")

    cmd = [
        ffmpeg_path, "-y",
        "-i", video_path,
        "-vn",  # No video
        "-acodec", "aac",
        "-b:a", "128k",
        output_path
    ]

    result = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace")

    if result.returncode != 0:
        print(f"FFmpeg error: {result.stderr}")
        # Try without ffmpeg using moviepy as fallback
        try:
            from moviepy.editor import VideoFileClip
            video = VideoFileClip(video_path)
            video.audio.write_audiofile(output_path)
            video.close()
        except ImportError:
            raise Exception(f"Failed to extract audio: {result.stderr}")

    return output_path


def extract_frames(
    video_path: str,
    interval_seconds: int = 30,
    max_frames: int = 20
) -> List[Tuple[float, str]]:
    """
    Extract key frames from video at regular intervals
    Returns list of (timestamp, base64_image) tuples
    """
    cap = cv2.VideoCapture(video_path)

    if not cap.isOpened():
        raise Exception(f"Could not open video: {video_path}")

    fps = cap.get(cv2.CAP_PROP_FPS)
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    duration = total_frames / fps

    frames = []
    frame_interval = int(fps * interval_seconds)

    # Adjust interval if we'd get too many frames
    if duration / interval_seconds > max_frames:
        interval_seconds = duration / max_frames
        frame_interval = int(fps * interval_seconds)

    current_frame = 0

    while True:
        cap.set(cv2.CAP_PROP_POS_FRAMES, current_frame)
        ret, frame = cap.read()

        if not ret:
            break

        # Resize for efficiency (720p max)
        height, width = frame.shape[:2]
        if width > 1280:
            scale = 1280 / width
            frame = cv2.resize(frame, (1280, int(height * scale)))

        # Convert to base64
        _, buffer = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 85])
        base64_image = base64.b64encode(buffer).decode('utf-8')

        timestamp = current_frame / fps
        frames.append((timestamp, base64_image))

        current_frame += frame_interval

        if current_frame >= total_frames:
            break

    cap.release()

    print(f"Extracted {len(frames)} frames from {duration:.1f}s video")
    return frames


def save_frame_thumbnails(
    frames: List[Tuple[float, str]],
    content_id: str,
    output_dir: str = "data/thumbnails"
) -> List[dict]:
    """Save frame thumbnails to Vercel Blob (or local disk as fallback).

    Args:
        frames: List of (timestamp, base64_image) tuples from extract_frames()
        content_id: Content ID for subdirectory
        output_dir: Root thumbnails directory (used for local fallback only)

    Returns:
        List of {timestamp, filename, url} dicts (the thumbnail manifest)
    """
    import numpy as np

    # Check if Vercel Blob is available
    try:
        from blob_storage import upload_thumbnail, is_blob_enabled
        use_blob = is_blob_enabled()
    except ImportError:
        use_blob = False

    # Local fallback directory
    if not use_blob:
        thumb_dir = os.path.join(output_dir, content_id)
        os.makedirs(thumb_dir, exist_ok=True)

    manifest = []
    for timestamp, b64_image in frames:
        # Decode base64 to image
        img_bytes = base64.b64decode(b64_image)
        img_array = np.frombuffer(img_bytes, dtype=np.uint8)
        img = cv2.imdecode(img_array, cv2.IMREAD_COLOR)
        if img is None:
            continue

        # Resize to 320px wide, maintain aspect ratio
        h, w = img.shape[:2]
        target_w = 320
        scale = target_w / w
        target_h = int(h * scale)
        thumb = cv2.resize(img, (target_w, target_h))

        # Encode to JPEG bytes
        filename = f"{round(timestamp)}.jpg"
        _, jpeg_buffer = cv2.imencode('.jpg', thumb, [cv2.IMWRITE_JPEG_QUALITY, 80])
        jpeg_bytes = jpeg_buffer.tobytes()

        if use_blob:
            # Upload to Vercel Blob
            try:
                blob_url = upload_thumbnail(jpeg_bytes, f"thumbnails/{content_id}/{filename}")
                manifest.append({"timestamp": timestamp, "filename": filename, "url": blob_url})
            except Exception as e:
                print(f"Warning: Blob upload failed for {filename}: {e}")
                # Fallback to local
                thumb_dir = os.path.join(output_dir, content_id)
                os.makedirs(thumb_dir, exist_ok=True)
                filepath = os.path.join(thumb_dir, filename)
                cv2.imwrite(filepath, thumb, [cv2.IMWRITE_JPEG_QUALITY, 80])
                manifest.append({"timestamp": timestamp, "filename": filename})
        else:
            # Save locally
            filepath = os.path.join(thumb_dir, filename)
            cv2.imwrite(filepath, thumb, [cv2.IMWRITE_JPEG_QUALITY, 80])
            manifest.append({"timestamp": timestamp, "filename": filename})

    storage = "Vercel Blob" if use_blob else output_dir
    print(f"Saved {len(manifest)} thumbnails to {storage}")
    return manifest


def extract_frames_at_timestamps(
    video_path: str,
    timestamps: List[float]
) -> List[Tuple[float, str]]:
    """Extract frames at specific timestamps (for backfill).

    Args:
        video_path: Path to the video file
        timestamps: List of timestamps in seconds

    Returns:
        List of (timestamp, base64_image) tuples
    """
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        raise Exception(f"Could not open video: {video_path}")

    fps = cap.get(cv2.CAP_PROP_FPS)
    frames = []

    for ts in sorted(timestamps):
        frame_num = int(ts * fps)
        cap.set(cv2.CAP_PROP_POS_FRAMES, frame_num)
        ret, frame = cap.read()
        if not ret:
            continue

        # Resize for efficiency (720p max)
        height, width = frame.shape[:2]
        if width > 1280:
            scale = 1280 / width
            frame = cv2.resize(frame, (1280, int(height * scale)))

        _, buffer = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 85])
        base64_image = base64.b64encode(buffer).decode('utf-8')
        frames.append((ts, base64_image))

    cap.release()
    print(f"Extracted {len(frames)} frames at specific timestamps")
    return frames


def get_video_info(video_path: str) -> dict:
    """Get basic video information"""
    cap = cv2.VideoCapture(video_path)

    info = {
        "path": video_path,
        "fps": cap.get(cv2.CAP_PROP_FPS),
        "frame_count": int(cap.get(cv2.CAP_PROP_FRAME_COUNT)),
        "width": int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)),
        "height": int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT)),
    }
    info["duration"] = info["frame_count"] / info["fps"] if info["fps"] > 0 else 0

    # File size for storage tracking
    try:
        info["file_size_bytes"] = os.path.getsize(video_path)
    except OSError:
        info["file_size_bytes"] = 0

    cap.release()
    return info


if __name__ == "__main__":
    # Test with a sample video
    import sys
    if len(sys.argv) > 1:
        video_path = sys.argv[1]
        print(get_video_info(video_path))
        frames = extract_frames(video_path, interval_seconds=30)
        print(f"Extracted {len(frames)} frames")
