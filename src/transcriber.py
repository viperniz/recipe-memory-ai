"""
Audio Transcription Module
Uses OpenAI Whisper API for speech-to-text
"""

import os
import math
from pathlib import Path
from typing import Optional
import json

from openai import OpenAI
from video_processor import get_ffmpeg_path

# Formats the Whisper API accepts directly
WHISPER_ACCEPTED = {".mp3", ".mp4", ".mpeg", ".mpga", ".m4a", ".wav", ".webm"}

# OpenAI Whisper API file size limit (25 MB)
MAX_FILE_SIZE = 25 * 1024 * 1024


class Transcriber:
    def __init__(self):
        """Initialize OpenAI Whisper API client"""
        self.client = OpenAI()
        print("Transcriber ready (OpenAI Whisper API)")

    def transcribe(
        self,
        audio_path: str,
        language: Optional[str] = None,
        task: str = "transcribe"
    ) -> dict:
        """
        Transcribe audio/video file using OpenAI Whisper API.

        Args:
            audio_path: Path to audio or video file
            language: Language code (e.g., 'en', 'es') or None for auto-detect
            task: 'transcribe' or 'translate' (translate to English)

        Returns:
            dict with 'text', 'segments', 'language'
        """
        print(f"Transcribing: {audio_path}")

        file_size = os.path.getsize(audio_path)
        ext = Path(audio_path).suffix.lower()

        # If the file is an accepted format AND under the size limit, send directly
        if ext in WHISPER_ACCEPTED and file_size <= MAX_FILE_SIZE:
            print(f"Sending {ext} file directly to API ({file_size / 1024 / 1024:.1f}MB)")
            return self._transcribe_file(audio_path, language, task)

        # File too large or not accepted — strip video track (stream copy, no re-encode)
        audio_file = self._strip_to_audio(audio_path)
        cleanup = audio_file != audio_path

        try:
            file_size = os.path.getsize(audio_file)
            if file_size <= MAX_FILE_SIZE:
                print(f"Audio-only file is {file_size / 1024 / 1024:.1f}MB, sending to API")
                return self._transcribe_file(audio_file, language, task)
            else:
                print(f"Audio file is {file_size / 1024 / 1024:.1f}MB (>{MAX_FILE_SIZE // 1024 // 1024}MB), splitting into chunks...")
                return self._transcribe_chunked(audio_file, language, task)
        finally:
            if cleanup and os.path.exists(audio_file):
                try:
                    os.remove(audio_file)
                except OSError:
                    pass

    def _strip_to_audio(self, video_path: str) -> str:
        """Strip video stream, extracting audio into m4a for Whisper API.

        Tries stream-copy first (instant). If that fails (e.g. Opus in webm
        can't be placed in m4a), falls back to re-encoding as AAC.
        Uses a safe temp filename to avoid non-ASCII path issues on Windows.
        """
        import subprocess

        # Use a safe ASCII temp path to avoid encoding issues with non-English titles
        tmp_dir = Path(video_path).parent
        output_path = os.path.join(tmp_dir, f"_audio_{os.getpid()}.m4a")
        ffmpeg_path = get_ffmpeg_path()

        # Resolve to absolute path to avoid ffmpeg misinterpreting brackets/special chars
        abs_video_path = str(Path(video_path).resolve())

        # Attempt 1: stream copy (fast, no re-encode)
        cmd = [
            ffmpeg_path, "-y",
            "-i", abs_video_path,
            "-vn",
            "-acodec", "copy",
            output_path,
        ]
        print(f"Stripping video track (stream copy)...")
        result = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace")

        if result.returncode == 0 and os.path.exists(output_path) and os.path.getsize(output_path) > 0:
            return output_path

        # Attempt 2: re-encode to AAC (handles Opus/Vorbis sources)
        print(f"Stream copy failed (rc={result.returncode}), re-encoding to AAC...")
        cmd = [
            ffmpeg_path, "-y",
            "-i", abs_video_path,
            "-vn",
            "-acodec", "aac",
            "-b:a", "128k",
            output_path,
        ]
        result = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace")

        if result.returncode != 0:
            err = result.stderr.strip() or result.stdout.strip() or f"ffmpeg exited with code {result.returncode}"
            raise RuntimeError(f"Failed to extract audio: {err}")

        return output_path

    def _transcribe_file(
        self,
        audio_path: str,
        language: Optional[str] = None,
        task: str = "transcribe"
    ) -> dict:
        """Transcribe a single audio file via the API."""
        kwargs = {
            "model": "whisper-1",
            "response_format": "verbose_json",
            "timestamp_granularities": ["segment"],
        }
        if language:
            kwargs["language"] = language

        with open(audio_path, "rb") as f:
            if task == "translate":
                response = self.client.audio.translations.create(file=f, **kwargs)
            else:
                response = self.client.audio.transcriptions.create(file=f, **kwargs)

        segments = []
        for seg in getattr(response, "segments", []) or []:
            segments.append({
                "start": seg.start,
                "end": seg.end,
                "text": seg.text.strip(),
            })

        return {
            "text": response.text,
            "language": getattr(response, "language", language or "en"),
            "segments": segments,
        }

    def _transcribe_chunked(
        self,
        audio_path: str,
        language: Optional[str] = None,
        task: str = "transcribe"
    ) -> dict:
        """Split a large audio file into chunks and transcribe each."""
        import subprocess

        ffmpeg_path = get_ffmpeg_path()
        file_size = os.path.getsize(audio_path)

        # Determine audio duration using ffprobe / ffmpeg
        duration = self._get_duration(audio_path, ffmpeg_path)
        if duration <= 0:
            raise RuntimeError("Could not determine audio duration for chunking")

        # Calculate chunk duration so each chunk is under the size limit
        num_chunks = math.ceil(file_size / (MAX_FILE_SIZE * 0.9))  # 90% to be safe
        chunk_duration = duration / num_chunks

        all_text = []
        all_segments = []
        detected_language = language or "en"
        base = Path(audio_path)
        time_offset = 0.0

        for i in range(num_chunks):
            start_time = i * chunk_duration
            chunk_path = str(base.parent / f"{base.stem}_chunk{i}{base.suffix}")

            cmd = [
                ffmpeg_path, "-y",
                "-i", audio_path,
                "-ss", str(start_time),
                "-t", str(chunk_duration),
                "-acodec", "copy",
                chunk_path,
            ]
            subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace")

            if not os.path.exists(chunk_path):
                continue

            try:
                result = self._transcribe_file(chunk_path, language, task)

                all_text.append(result["text"])
                detected_language = result.get("language", detected_language)

                for seg in result["segments"]:
                    all_segments.append({
                        "start": seg["start"] + start_time,
                        "end": seg["end"] + start_time,
                        "text": seg["text"],
                    })
            finally:
                try:
                    os.remove(chunk_path)
                except OSError:
                    pass

        return {
            "text": " ".join(all_text),
            "language": detected_language,
            "segments": all_segments,
        }

    def _get_duration(self, audio_path: str, ffmpeg_path: str) -> float:
        """Get duration of an audio file in seconds."""
        import subprocess

        # Try ffprobe first (same directory as ffmpeg)
        ffprobe_path = str(Path(ffmpeg_path).parent / ("ffprobe.exe" if os.name == "nt" else "ffprobe"))
        if not os.path.exists(ffprobe_path):
            ffprobe_path = "ffprobe"

        cmd = [
            ffprobe_path,
            "-v", "error",
            "-show_entries", "format=duration",
            "-of", "default=noprint_wrappers=1:nokey=1",
            audio_path,
        ]
        try:
            result = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=30)
            if result.returncode == 0 and result.stdout.strip():
                return float(result.stdout.strip())
        except Exception:
            pass

        return 0.0

    def transcribe_with_timestamps(self, audio_path: str) -> str:
        """Get transcription with timestamps for each segment"""
        result = self.transcribe(audio_path)

        lines = []
        for seg in result["segments"]:
            start = self._format_time(seg["start"])
            end = self._format_time(seg["end"])
            lines.append(f"[{start} - {end}] {seg['text']}")

        return "\n".join(lines)

    def _format_time(self, seconds: float) -> str:
        """Format seconds as MM:SS"""
        mins = int(seconds // 60)
        secs = int(seconds % 60)
        return f"{mins:02d}:{secs:02d}"


def transcribe_video(video_path: str) -> dict:
    """Convenience function to transcribe a video file"""
    transcriber = Transcriber()
    return transcriber.transcribe(video_path)


if __name__ == "__main__":
    import sys

    if len(sys.argv) > 1:
        path = sys.argv[1]

        transcriber = Transcriber()
        result = transcriber.transcribe(path)

        print(f"\nLanguage detected: {result['language']}")
        print(f"\nTranscription:\n{result['text']}")

        # Save to file
        output_path = Path(path).stem + "_transcript.json"
        with open(output_path, "w") as f:
            json.dump(result, f, indent=2)
        print(f"\nSaved to: {output_path}")
