"""
Video Memory AI - Main Application
Extracts structured information from videos and stores in memory for later retrieval
"""

import os
import sys
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Optional

# Add src to path
sys.path.insert(0, str(Path(__file__).parent))

from video_processor import download_video, download_audio, extract_frames, extract_audio, get_video_info, save_frame_thumbnails, _extract_video_id
from transcriber import Transcriber
from content_analyzer import ContentAnalyzer, ContentExtract
from speaker_diarization import SpeakerDiarizer
from content_creator import TopTenGenerator, ContentSpinner, TopTenScript, SpunContent

import json
from config import get_config

# Pre-import openai submodules to prevent import deadlock in threads.
# Python's import lock can deadlock when two threads trigger lazy imports
# of the same module simultaneously (e.g. openai.resources.chat).
try:
    import openai
    import openai.resources.audio
    import openai.resources.chat
except ImportError:
    pass


class VideoMemoryAI:
    def __init__(
        self,
        llm_provider: str = "openai",
        data_dir: str = "data",
        db = None,  # Optional database session
        user_id: Optional[int] = None,  # Optional user ID
        tier: str = "free"  # Subscription tier for AI model gating
    ):
        """
        Initialize the Video Memory AI system

        Args:
            llm_provider: "openai" or "ollama" for content extraction
            data_dir: Directory for storing data
            db: Optional SQLAlchemy session for VectorMemory
            user_id: Optional user ID for VectorMemory
            tier: Subscription tier (free/starter/pro/team) for model selection
        """
        self.data_dir = Path(data_dir)
        self.data_dir.mkdir(parents=True, exist_ok=True)

        print("Initializing Video Memory AI...")

        # Initialize components
        self.transcriber = None  # Lazy load to save memory
        self.diarizer = None  # Lazy load speaker diarization

        self.analyzer = ContentAnalyzer(provider=llm_provider, tier=tier)

        # Use VectorMemory (PostgreSQL/SQLite) for storage
        if db is not None and user_id is not None:
            from vector_memory import VectorMemory
            self.memory = VectorMemory(db, user_id)
            print(f"Ready! Using {llm_provider} for analysis, OpenAI Whisper API for transcription.")
            print(f"Using VectorMemory for storage (user_id: {user_id})\n")
        else:
            # Memory will be set later by caller (e.g. get_app() in api.py)
            self.memory = None
            print(f"Ready! Using {llm_provider} for analysis. Memory backend will be set by caller.")

    # All languages supported by OpenAI Whisper
    LANGUAGE_NAMES = {
        "af": "Afrikaans", "am": "Amharic", "ar": "Arabic", "as": "Assamese",
        "az": "Azerbaijani", "ba": "Bashkir", "be": "Belarusian", "bg": "Bulgarian",
        "bn": "Bengali", "bo": "Tibetan", "br": "Breton", "bs": "Bosnian",
        "ca": "Catalan", "cs": "Czech", "cy": "Welsh", "da": "Danish",
        "de": "German", "el": "Greek", "en": "English", "es": "Spanish",
        "et": "Estonian", "eu": "Basque", "fa": "Persian", "fi": "Finnish",
        "fo": "Faroese", "fr": "French", "gl": "Galician", "gu": "Gujarati",
        "ha": "Hausa", "haw": "Hawaiian", "he": "Hebrew", "hi": "Hindi",
        "hr": "Croatian", "ht": "Haitian Creole", "hu": "Hungarian", "hy": "Armenian",
        "id": "Indonesian", "is": "Icelandic", "it": "Italian", "ja": "Japanese",
        "jw": "Javanese", "ka": "Georgian", "kk": "Kazakh", "km": "Khmer",
        "kn": "Kannada", "ko": "Korean", "la": "Latin", "lb": "Luxembourgish",
        "ln": "Lingala", "lo": "Lao", "lt": "Lithuanian", "lv": "Latvian",
        "mg": "Malagasy", "mi": "Maori", "mk": "Macedonian", "ml": "Malayalam",
        "mn": "Mongolian", "mr": "Marathi", "ms": "Malay", "mt": "Maltese",
        "my": "Myanmar", "ne": "Nepali", "nl": "Dutch", "nn": "Nynorsk",
        "no": "Norwegian", "oc": "Occitan", "pa": "Punjabi", "pl": "Polish",
        "ps": "Pashto", "pt": "Portuguese", "ro": "Romanian", "ru": "Russian",
        "sa": "Sanskrit", "sd": "Sindhi", "si": "Sinhala", "sk": "Slovak",
        "sl": "Slovenian", "sn": "Shona", "so": "Somali", "sq": "Albanian",
        "sr": "Serbian", "su": "Sundanese", "sv": "Swedish", "sw": "Swahili",
        "ta": "Tamil", "te": "Telugu", "tg": "Tajik", "th": "Thai",
        "tk": "Turkmen", "tl": "Tagalog", "tr": "Turkish", "tt": "Tatar",
        "uk": "Ukrainian", "ur": "Urdu", "uz": "Uzbek", "vi": "Vietnamese",
        "yi": "Yiddish", "yo": "Yoruba", "zh": "Chinese", "yue": "Cantonese",
    }

    def _get_transcriber(self):
        """Lazy load transcriber"""
        if self.transcriber is None:
            self.transcriber = Transcriber()
        return self.transcriber

    def _translate_chunk(self, text: str, lang_name: str, preserve_timestamps: bool = False) -> str:
        """Translate a single chunk of text using GPT."""
        if preserve_timestamps:
            instruction = (
                f"Translate the following transcript to {lang_name}. "
                f"Keep all timestamps (e.g. [0:00], [1:23]) and speaker labels exactly as they are. "
                f"Only translate the spoken text. Return ONLY the translated transcript, nothing else."
            )
        else:
            instruction = (
                f"Translate the following text to {lang_name}. "
                f"Return ONLY the translation, nothing else."
            )

        prompt = f"{instruction}\n\n{text}"

        if self.analyzer.provider == "openai":
            response = self.analyzer.client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[{"role": "user", "content": prompt}],
                max_tokens=16000,
            )
            return response.choices[0].message.content.strip()
        else:
            response = self.analyzer.client.chat(
                model=self.analyzer.model,
                messages=[{"role": "user", "content": prompt}],
            )
            return response["message"]["content"].strip()

    def _translate_transcript(self, raw_text: str, formatted_text: str, target_lang: str):
        """Translate transcript text to the target language using GPT.
        Splits long transcripts into chunks to avoid token limits."""
        lang_name = self.LANGUAGE_NAMES.get(target_lang, target_lang)
        chunk_size = 10000  # chars per chunk (safe for gpt-4o-mini context)

        try:
            # Translate formatted transcript (with timestamps) in chunks
            if len(formatted_text) <= chunk_size:
                translated_formatted = self._translate_chunk(formatted_text, lang_name, preserve_timestamps=True)
            else:
                # Split on line breaks to keep timestamps intact
                lines = formatted_text.split('\n')
                chunks = []
                current = []
                current_len = 0
                for line in lines:
                    if current_len + len(line) > chunk_size and current:
                        chunks.append('\n'.join(current))
                        current = []
                        current_len = 0
                    current.append(line)
                    current_len += len(line) + 1
                if current:
                    chunks.append('\n'.join(current))

                translated_parts = []
                for i, chunk in enumerate(chunks):
                    print(f"  Translating chunk {i+1}/{len(chunks)}...")
                    translated_parts.append(self._translate_chunk(chunk, lang_name, preserve_timestamps=True))
                translated_formatted = '\n'.join(translated_parts)

            # Translate raw text (used for content extraction)
            if len(raw_text) <= chunk_size:
                translated_raw = self._translate_chunk(raw_text, lang_name, preserve_timestamps=False)
            else:
                # Split raw text by sentences/paragraphs
                parts = raw_text.split('. ')
                chunks = []
                current = []
                current_len = 0
                for part in parts:
                    if current_len + len(part) > chunk_size and current:
                        chunks.append('. '.join(current))
                        current = []
                        current_len = 0
                    current.append(part)
                    current_len += len(part) + 2
                if current:
                    chunks.append('. '.join(current))
                translated_raw = ' '.join(
                    self._translate_chunk(c, lang_name, preserve_timestamps=False) for c in chunks
                )

            print(f"Translated transcript to {lang_name} ({len(translated_formatted)} chars)")
            return translated_raw, translated_formatted

        except Exception as e:
            print(f"Translation failed, keeping original: {e}")
            return raw_text, formatted_text

    def _get_diarizer(self):
        """Lazy load speaker diarizer"""
        if self.diarizer is None:
            try:
                self.diarizer = SpeakerDiarizer()
            except Exception as e:
                print(f"Speaker diarization not available: {e}")
                return None
        return self.diarizer

    def _group_transcript_paragraphs(self, segments: list) -> list:
        """Group transcript segments into paragraphs with timestamps, end times, and speakers.

        Returns:
            List of dicts: [{timestamp, end, speaker, text}, ...]
        """
        if not segments:
            return []

        paragraphs = []
        current_text = []
        current_start = 0
        current_end = 0
        current_speaker = None
        sentence_count = 0

        for i, seg in enumerate(segments):
            text = seg.get("text", "").strip()
            if not text:
                continue

            start = seg.get("start", 0)
            end = seg.get("end", start)
            speaker = seg.get("speaker", None)

            # Start first paragraph
            if not current_text:
                current_start = start
                current_speaker = speaker

            # Break paragraph on speaker change
            speaker_changed = speaker and current_speaker and speaker != current_speaker

            current_text.append(text)
            current_end = end

            # Count sentences
            sentence_count += text.count('.') + text.count('!') + text.count('?')

            # Check if previous segment exists
            prev_end = segments[i - 1].get("end", 0) if i > 0 else 0

            # Break paragraph conditions
            should_break = (
                speaker_changed or
                sentence_count >= 5 or
                (sentence_count >= 3 and start - current_start > 25) or
                (len(current_text) > 1 and start - prev_end > 3)
            )

            if should_break and current_text:
                paragraphs.append({
                    "timestamp": current_start,
                    "end": current_end,
                    "speaker": current_speaker,
                    "text": " ".join(current_text).strip()
                })
                current_text = []
                sentence_count = 0
                current_start = start
                current_end = end
                current_speaker = speaker

        # Add remaining text
        if current_text:
            paragraphs.append({
                "timestamp": current_start,
                "end": current_end,
                "speaker": current_speaker,
                "text": " ".join(current_text).strip()
            })

        return paragraphs

    def _format_transcript(self, segments: list) -> str:
        """Format transcript segments into structured paragraphs with timestamps and speakers"""
        paragraphs = self._group_transcript_paragraphs(segments)
        if not paragraphs:
            return ""

        # Format as readable string with timestamps and speakers
        formatted_parts = []
        for p in paragraphs:
            mins = int(p["timestamp"] // 60)
            secs = int(p["timestamp"] % 60)
            speaker_label = p.get("speaker", "")

            # Format speaker label to be more readable
            if speaker_label and speaker_label != "Unknown":
                # Convert SPEAKER_00 to Speaker 1, SPEAKER_01 to Speaker 2, etc.
                if speaker_label.startswith("SPEAKER_"):
                    try:
                        speaker_num = int(speaker_label.split("_")[1]) + 1
                        speaker_label = f"Speaker {speaker_num}"
                    except (ValueError, IndexError):
                        pass  # Keep original if parsing fails

                formatted_parts.append(f'[{mins}:{secs:02d}] {speaker_label}\n{p["text"]}')
            else:
                formatted_parts.append(f'[{mins}:{secs:02d}]\n{p["text"]}')

        return "\n\n".join(formatted_parts)

    def _build_timeline(self, segments: list, frame_descriptions: list,
                         content_id: str = None, frame_analyses: list = None) -> list:
        """Build a unified chronological timeline merging transcript paragraphs and vision frame descriptions.

        Args:
            segments: Raw Whisper segments [{start, end, text, speaker}, ...]
            frame_descriptions: Vision descriptions ["[Ns] description", ...]
            content_id: Content ID for thumbnail paths
            frame_analyses: Optional [{timestamp, caption, description}] from analyzer

        Returns:
            List of timeline entries sorted by timestamp:
            [{type: "transcript"|"vision", timestamp: float, text: str, ...}, ...]
        """
        import re

        timeline = []

        # Build a lookup from frame_analyses for captions
        caption_map = {}
        if frame_analyses:
            for fa in frame_analyses:
                caption_map[int(fa["timestamp"])] = fa.get("caption", "")

        # Add transcript paragraphs
        paragraphs = self._group_transcript_paragraphs(segments)
        for p in paragraphs:
            speaker = p.get("speaker", None)
            # Format speaker label
            if speaker and speaker.startswith("SPEAKER_"):
                try:
                    speaker_num = int(speaker.split("_")[1]) + 1
                    speaker = f"Speaker {speaker_num}"
                except (ValueError, IndexError):
                    pass
            timeline.append({
                "type": "transcript",
                "timestamp": p["timestamp"],
                "end": p["end"],
                "text": p["text"],
                                "speaker": speaker
            })

        # Add vision frame descriptions
        if frame_descriptions:
            for desc in frame_descriptions:
                match = re.match(r'^\[(\d+(?:\.\d+)?)s\]\s*(.*)', desc, re.DOTALL)
                if match:
                    ts = float(match.group(1))
                    text = match.group(2).strip()
                    entry = {
                        "type": "vision",
                        "timestamp": ts,
                        "text": text
                    }
                    # Add caption if available
                    caption = caption_map.get(int(ts), "")
                    if caption:
                        entry["caption"] = caption
                    # Add thumbnail path if content_id is known
                    if content_id:
                        entry["thumbnail"] = f"{get_config().api_base_url}/api/thumbnails/{content_id}/{int(ts)}.jpg"
                    timeline.append(entry)

        # Sort by timestamp
        timeline.sort(key=lambda e: e["timestamp"])

        return timeline

    def process_video(
        self,
        source: str,
        analyze_frames: bool = True,
        frame_interval: int = 30,
        save_content: bool = True,
        progress_callback: callable = None,
        detect_speakers: bool = True,
        user_id: int = None,
        mode: str = "general",
        youtube_stats: dict = None,
        language: str = None
    ) -> ContentExtract:
        """
        Process a video and extract structured information

        Args:
            source: Video file path or YouTube URL
            analyze_frames: Whether to analyze video frames (uses vision API)
            frame_interval: Seconds between frame extractions
            save_content: Whether to save to memory
            progress_callback: Optional callback(percent, status) for progress updates
            detect_speakers: Whether to detect different speakers
            user_id: Optional user ID for multi-tenant isolation

        Returns:
            Extracted ContentExtract object
        """
        def update_progress(pct, status):
            if progress_callback:
                progress_callback(pct, status)

        is_url = source.startswith(('http://', 'https://', 'www.'))
        video_path = source
        audio_path = None
        source_url = None

        # =============================================
        # Phase 1: Download (parallel audio + video for URLs)
        # =============================================
        if is_url:
            source_url = source
            update_progress(5, "Downloading...")
            print(f"Downloading from: {source}")

            download_done = threading.Event()

            def simulate_download_progress():
                pct = 6
                update_progress(pct, "Downloading...")
                while not download_done.is_set():
                    time.sleep(1.5)
                    if pct < 14:
                        pct += 1
                        update_progress(pct, "Downloading...")

            dl_progress_thread = threading.Thread(target=simulate_download_progress, daemon=True)
            dl_progress_thread.start()

            try:
                videos_dir = str(self.data_dir / "videos")
                if analyze_frames:
                    # Need both audio (for transcription) and video (for frames)
                    # Download sequentially to limit peak memory (avoid 2 concurrent yt-dlp subprocesses)
                    audio_path = download_audio(source, videos_dir)
                    print(f"  Audio: {audio_path}")
                    video_path = download_video(source, videos_dir)
                    print(f"  Video: {video_path}")
                else:
                    # No frame analysis — only need audio (~5MB instead of ~300MB)
                    audio_path = download_audio(source, videos_dir)
                    video_path = audio_path  # Used for get_video_info fallback
                    print(f"  Audio only: {audio_path}")
            finally:
                download_done.set()
                dl_progress_thread.join(timeout=1)

            update_progress(15, "Downloaded")
        else:
            # Local file — use as-is for both audio and video
            audio_path = source

        print(f"\nProcessing: {video_path}")

        # Get video info (duration, resolution) — works on video or audio files
        info = get_video_info(video_path) if analyze_frames or not is_url else {"duration": 0, "width": 0, "height": 0}
        if info.get("duration", 0) > 0:
            print(f"Duration: {info['duration']:.1f}s, Resolution: {info['width']}x{info['height']}")

        # =============================================
        # Phase 2: Parallel transcription + frame analysis
        # =============================================
        # Thread A: transcribe → diarize → format transcript
        # Thread B: extract frames → analyze frames in parallel (only if analyze_frames)
        transcript = None
        transcript_result = None
        segments = None
        frame_descriptions = []
        frame_analyses = []
        raw_frames = []

        def do_transcription():
            """Thread A: Transcribe audio, diarize, format transcript."""
            nonlocal transcript, transcript_result, segments
            update_progress(15, "Transcribing audio...")
            print("\n[Thread A] Transcribing audio...")

            transcriber = self._get_transcriber()
            whisper_task = "transcribe"
            if language and language == "en":
                whisper_task = "translate"

            # Transcribe using audio file (much smaller than video)
            transcript_result = transcriber.transcribe(audio_path, task=whisper_task)
            transcript = transcript_result["text"]
            segments = transcript_result["segments"]
            print(f"[Thread A] Transcribed {len(transcript)} characters in {transcript_result['language']}")

            update_progress(30, "Transcribed")

            # Speaker diarization
            if detect_speakers:
                update_progress(30, "Detecting speakers...")
                print("[Thread A] Detecting speakers...")
                try:
                    diarizer = self._get_diarizer()
                    if diarizer:
                        speaker_segs = diarizer.diarize(audio_path)
                        segments[:] = diarizer.merge_with_transcript(segments, speaker_segs)
                        print(f"[Thread A] Detected {len(set(s.get('speaker') for s in segments))} speakers")
                except Exception as e:
                    print(f"[Thread A] Speaker detection skipped: {e}")

            update_progress(40, "Transcript ready")

        def do_frame_analysis():
            """Thread B: Extract frames and analyze them in parallel."""
            nonlocal frame_descriptions, frame_analyses, raw_frames
            update_progress(42, "Extracting frames...")
            print(f"\n[Thread B] Extracting frames (every {frame_interval}s)...")

            raw_frames = extract_frames(video_path, interval_seconds=frame_interval)
            total_frames = len(raw_frames)
            update_progress(45, f"Extracted {total_frames} frames")
            print(f"[Thread B] Extracted {total_frames} frames, analyzing in parallel...")

            def frame_progress(completed, total):
                pct = 45 + int((completed / max(total, 1)) * 40)
                update_progress(pct, f"Analyzing frame {completed}/{total}")

            frame_descriptions = self.analyzer.analyze_frames_parallel(
                raw_frames, with_captions=True, max_workers=3,
                progress_callback=frame_progress
            )
            if hasattr(self.analyzer, '_last_frame_analyses'):
                frame_analyses = list(self.analyzer._last_frame_analyses)

            update_progress(85, "Frames analyzed")
            print(f"[Thread B] Analyzed {len(frame_descriptions)} frames")

        # Run transcription and frame analysis in parallel
        if analyze_frames:
            with ThreadPoolExecutor(max_workers=2) as executor:
                transcription_future = executor.submit(do_transcription)
                frame_future = executor.submit(do_frame_analysis)

                # Wait for both to complete, propagate exceptions
                transcription_future.result()
                frame_future.result()
        else:
            # No frame analysis — just transcribe sequentially
            # Simulate progress during transcription
            transcription_done = threading.Event()

            def simulate_transcription_progress():
                pct = 16
                update_progress(pct, "Transcribing audio...")
                while not transcription_done.is_set():
                    time.sleep(1.5)
                    if pct < 28:
                        pct += 1
                        update_progress(pct, "Transcribing audio...")

            progress_thread = threading.Thread(target=simulate_transcription_progress, daemon=True)
            progress_thread.start()

            try:
                do_transcription()
            finally:
                transcription_done.set()
                progress_thread.join(timeout=1)

            print("\n[3/4] Skipping frame analysis")
            update_progress(50, "Skipped frames")

        # =============================================
        # Phase 3: Post-processing (needs results from both threads)
        # =============================================

        # Format transcript with timestamps and speakers
        formatted_transcript = self._format_transcript(segments)

        # Auto-detected language from Whisper
        detected_lang = transcript_result.get("language", "en")
        detected_lang_name = self.LANGUAGE_NAMES.get(detected_lang, detected_lang)
        print(f"Detected language: {detected_lang_name} ({detected_lang})")

        # Translate transcript if a different output language is requested
        translated = False
        whisper_already_translated = (language == "en" and detected_lang != "en")
        if whisper_already_translated:
            translated = True
            print(f"Whisper translated {detected_lang_name} → English during transcription")
        elif language and language != "auto" and language != detected_lang:
            update_progress(85, f"Translating from {detected_lang_name}")
            print(f"\nTranslating transcript from {detected_lang_name} to {self.LANGUAGE_NAMES.get(language, language)}...")
            transcript, formatted_transcript = self._translate_transcript(
                transcript, formatted_transcript, language
            )
            translated = True

        thumbnail_manifest = []

        # Step 4: Extract content
        update_progress(86, "Extracting information")
        print("\n[4/4] Extracting information...")

        # Simulate progress during LLM extraction
        extraction_done = threading.Event()

        def simulate_extraction_progress():
            base_pct = 86
            target_pct = 94
            duration = 0
            while not extraction_done.is_set():
                elapsed = min(duration / 20.0, 1.0)
                pct = base_pct + (target_pct - base_pct) * elapsed
                update_progress(int(pct), "Extracting information...")
                time.sleep(1)
                duration += 1

        progress_thread = threading.Thread(target=simulate_extraction_progress, daemon=True)
        progress_thread.start()

        try:
            content = self.analyzer.extract_content(
                transcript=transcript,
                frame_descriptions=frame_descriptions,
                video_path=video_path,
                source_url=source_url,
                duration_seconds=int(info['duration']) if info.get('duration') else None,
                formatted_transcript=formatted_transcript,
                mode=mode,
                youtube_stats=youtube_stats,
                language=language
            )
        finally:
            extraction_done.set()
            progress_thread.join(timeout=1)
        
        # Save frame thumbnails to disk
        if raw_frames and content.id:
            try:
                thumbnail_manifest = save_frame_thumbnails(raw_frames, content.id)
            except Exception as e:
                print(f"Warning: failed to save thumbnails: {e}")
                thumbnail_manifest = []
            # Free raw frame data to reclaim memory
            raw_frames.clear()

        # Store frame analyses and thumbnail manifest in content
        if frame_analyses:
            content.frame_analyses = frame_analyses
        content.metadata = content.metadata or {}
        if thumbnail_manifest:
            content.metadata["thumbnails"] = thumbnail_manifest

        # Store YouTube thumbnail URL for library cards
        if source_url:
            video_id = _extract_video_id(source_url)
            if video_id:
                content.metadata["youtube_thumbnail"] = f"https://img.youtube.com/vi/{video_id}/mqdefault.jpg"

        # Build unified timeline from transcript segments + vision frame descriptions
        if segments and frame_descriptions:
            content.timeline = self._build_timeline(
                segments, frame_descriptions,
                content_id=content.id,
                frame_analyses=frame_analyses
            )

        update_progress(95, "Saving")

        # Store language info in metadata
        content.metadata["detected_language"] = detected_lang
        content.metadata["detected_language_name"] = detected_lang_name
        if translated:
            content.metadata["translated_to"] = language
            content.metadata["translated_to_name"] = self.LANGUAGE_NAMES.get(language, language)

        print(f"\nExtracted: {content.title}")
        print(f"  Type: {content.content_type}")
        print(f"  Topics: {', '.join(content.topics[:5])}")
        print(f"  Key Points: {len(content.key_points)}")
        print(f"  Entities: {len(content.entities)}")

        # Save to memory
        if save_content:
            self.memory.add_content(content.to_dict(), user_id=user_id)
            print(f"\nSaved to memory with ID: {content.id}")

        # Also save JSON to file
        content_file = self.data_dir / "extracts" / f"{content.id}.json"
        content_file.parent.mkdir(exist_ok=True)
        with open(content_file, "w") as f:
            f.write(content.to_json())
        print(f"Content saved to: {content_file}")

        return content

    def process_transcript_only(
        self,
        transcript: str,
        title_hint: str = None,
        save_content: bool = True,
        user_id: int = None
    ) -> ContentExtract:
        """
        Process a transcript directly (no video needed)

        Args:
            transcript: The video transcript text
            title_hint: Optional hint for the content title
            save_content: Whether to save to memory
            user_id: Optional user ID for multi-tenant isolation

        Returns:
            Extracted ContentExtract object
        """
        print("Processing transcript...")

        content = self.analyzer.extract_content(
            transcript=transcript,
            frame_descriptions=[]
        )

        if save_content:
            self.memory.add_content(content.to_dict(), user_id=user_id)

        return content

    def search(self, query: str, n_results: int = 5) -> list:
        """Search for content by natural language query"""
        return self.memory.search(query, n_results=n_results)

    def search_by_topic(self, topics: list) -> list:
        """Find content covering specific topics"""
        return self.memory.search_by_topic(topics)

    def search_by_entity(self, entities: list) -> list:
        """Find content mentioning specific entities"""
        return self.memory.search_by_entity(entities)

    def get_content(self, content_id: str) -> dict:
        """Get specific content by ID"""
        return self.memory.get_content(content_id)

    def list_content(self, user_id: int = None) -> list:
        """List all stored content, optionally filtered by user_id"""
        return self.memory.list_all(user_id=user_id)

    def generate_top_ten(
        self,
        topic: str,
        query: str = None,
        num_videos: int = 5,
        num_items: int = 10,
        custom_instructions: str = None
    ) -> TopTenScript:
        """
        Generate a Top 10 script from stored content

        Args:
            topic: The topic for the Top 10 list (e.g., "Python Tips")
            query: Search query to find relevant videos (defaults to topic)
            num_videos: Number of source videos to use
            num_items: Number of items in the list (default 10)
            custom_instructions: Optional additional instructions

        Returns:
            TopTenScript object with the generated script
        """
        # Search for relevant content
        results = self.search(query or topic, n_results=num_videos)

        if not results:
            raise ValueError(f"No content found for query: {query or topic}")

        print(f"Generating Top {num_items} script from {len(results)} videos...")

        generator = TopTenGenerator(llm_provider=self.analyzer.provider)
        script = generator.generate(results, topic, num_items, custom_instructions)

        # Save the script
        script_file = self.data_dir / "scripts" / f"{script.id}.json"
        script_file.parent.mkdir(exist_ok=True)
        with open(script_file, "w") as f:
            json.dump(script.to_dict(), f, indent=2)

        print(f"Script saved to: {script_file}")
        return script

    def spin_content(
        self,
        content_id: str = None,
        content: dict = None,
        style: str = "casual",
        custom_instructions: str = None
    ) -> SpunContent:
        """
        Spin/reword existing content in a new style

        Args:
            content_id: ID of content to spin (will fetch from memory)
            content: Or pass content dict directly
            style: Target style (casual, professional, educational, entertaining)
            custom_instructions: Optional additional instructions

        Returns:
            SpunContent object with rewritten content
        """
        if content_id:
            content = self.get_content(content_id)
            if not content:
                raise ValueError(f"Content not found: {content_id}")
        elif not content:
            raise ValueError("Must provide either content_id or content")

        print(f"Spinning content in '{style}' style...")

        spinner = ContentSpinner(llm_provider=self.analyzer.provider)
        spun = spinner.spin(content, style, custom_instructions)

        # Save the spun content
        spun_file = self.data_dir / "spun" / f"{spun.id}.json"
        spun_file.parent.mkdir(exist_ok=True)
        with open(spun_file, "w") as f:
            json.dump(spun.to_dict(), f, indent=2)

        print(f"Spun content saved to: {spun_file}")
        return spun

    def spin_all_styles(
        self,
        content_id: str = None,
        content: dict = None
    ) -> list:
        """
        Generate all style variations of content

        Args:
            content_id: ID of content to spin
            content: Or pass content dict directly

        Returns:
            List of SpunContent objects (one per style)
        """
        if content_id:
            content = self.get_content(content_id)
            if not content:
                raise ValueError(f"Content not found: {content_id}")
        elif not content:
            raise ValueError("Must provide either content_id or content")

        spinner = ContentSpinner(llm_provider=self.analyzer.provider)
        results = spinner.spin_multiple_styles(content)

        # Save all versions
        for spun in results:
            spun_file = self.data_dir / "spun" / f"{spun.id}.json"
            spun_file.parent.mkdir(exist_ok=True)
            with open(spun_file, "w") as f:
                json.dump(spun.to_dict(), f, indent=2)

        print(f"Generated {len(results)} style variations")
        return results

    def combine_videos_script(
        self,
        query: str,
        topic: str,
        style: str = "casual",
        num_videos: int = 3
    ) -> SpunContent:
        """
        Combine insights from multiple videos into one new script

        Args:
            query: Search query to find relevant videos
            topic: Focus topic for the combined content
            style: Target style
            num_videos: Number of videos to combine

        Returns:
            SpunContent combining all sources
        """
        results = self.search(query, n_results=num_videos)

        if not results:
            raise ValueError(f"No content found for query: {query}")

        print(f"Combining {len(results)} videos into one script...")

        spinner = ContentSpinner(llm_provider=self.analyzer.provider)
        combined = spinner.combine_and_spin(results, style, topic)

        # Save
        spun_file = self.data_dir / "spun" / f"{combined.id}.json"
        spun_file.parent.mkdir(exist_ok=True)
        with open(spun_file, "w") as f:
            json.dump(combined.to_dict(), f, indent=2)

        print(f"Combined script saved to: {spun_file}")
        return combined

    def ask(self, question: str) -> str:
        """
        Ask a question about stored content using RAG

        Args:
            question: Natural language question

        Returns:
            AI-generated answer based on stored content
        """
        # Search for relevant content
        results = self.search(question, n_results=3)

        if not results:
            return "I don't have any content that matches your question. Try adding some videos first!"

        # Build context from results
        context = "Based on this content in my memory:\n\n"
        for r in results:
            context += f"**{r['title']}** ({r['content_type']})\n"
            context += f"Summary: {r.get('summary', '')}\n"
            context += f"Key points: {', '.join([kp.get('point', str(kp)) for kp in r.get('key_points', [])[:3]])}\n\n"

        # Generate answer
        prompt = f"""You are a helpful assistant with access to a knowledge base of video content.

{context}

User question: {question}

Provide a helpful, concise answer based on the content above. Reference specific videos or key points when relevant."""

        if self.analyzer.provider == "openai":
            response = self.analyzer.client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[{"role": "user", "content": prompt}]
            )
            return response.choices[0].message.content
        else:
            response = self.analyzer.client.chat(
                model=self.analyzer.model,
                messages=[{"role": "user", "content": prompt}]
            )
            return response["message"]["content"]


# Keep backward compatibility alias
RecipeMemoryAI = VideoMemoryAI


def main():
    """CLI interface"""
    import argparse

    parser = argparse.ArgumentParser(description="Video Memory AI")
    parser.add_argument("command", choices=["add", "search", "list", "ask", "get", "top10", "spin", "combine"],
                       help="Command to run")
    parser.add_argument("--source", "-s", help="Video file or URL (for 'add')")
    parser.add_argument("--query", "-q", help="Search query or question")
    parser.add_argument("--id", help="Content ID (for 'get', 'spin')")
    parser.add_argument("--topic", "-t", help="Topic for top10/combine scripts")
    parser.add_argument("--style", default="casual",
                       choices=["casual", "professional", "educational", "entertaining"],
                       help="Style for spin/combine (default: casual)")
    parser.add_argument("--num-items", type=int, default=10,
                       help="Number of items for top10 (default: 10)")
    parser.add_argument("--num-videos", type=int, default=5,
                       help="Number of source videos to use (default: 5)")
    parser.add_argument("--provider", default="openai", choices=["openai", "ollama"],
                       help="LLM provider")
    parser.add_argument("--no-frames", action="store_true",
                       help="Skip frame analysis (faster, less accurate)")

    args = parser.parse_args()

    # Initialize
    ai = VideoMemoryAI(
        llm_provider=args.provider
    )

    if args.command == "add":
        if not args.source:
            print("Error: --source required for 'add' command")
            return
        content = ai.process_video(
            args.source,
            analyze_frames=not args.no_frames
        )
        print(f"\nContent extracted and saved!")

    elif args.command == "search":
        if not args.query:
            print("Error: --query required for 'search' command")
            return
        results = ai.search(args.query)
        print(f"\nFound {len(results)} items:")
        for r in results:
            print(f"  - {r['title']} ({r['content_type']}) - {r.get('_similarity', 0):.1%} match")

    elif args.command == "list":
        contents = ai.list_content()
        print(f"\n{len(contents)} items in memory:")
        for c in contents:
            print(f"  - {c['title']} ({c['content_type']})")

    elif args.command == "ask":
        if not args.query:
            print("Error: --query required for 'ask' command")
            return
        answer = ai.ask(args.query)
        print(f"\n{answer}")

    elif args.command == "get":
        if not args.id:
            print("Error: --id required for 'get' command")
            return
        content = ai.get_content(args.id)
        if content:
            print(json.dumps(content, indent=2))
        else:
            print("Content not found")

    elif args.command == "top10":
        if not args.topic:
            print("Error: --topic required for 'top10' command")
            return
        script = ai.generate_top_ten(
            topic=args.topic,
            query=args.query,
            num_videos=args.num_videos,
            num_items=args.num_items
        )
        print(f"\n{'='*60}")
        print(script.to_script())
        print(f"{'='*60}")
        print(f"\nScript ID: {script.id}")
        print(f"Source videos: {len(script.source_videos)}")

    elif args.command == "spin":
        if not args.id:
            print("Error: --id required for 'spin' command")
            return
        spun = ai.spin_content(content_id=args.id, style=args.style)
        print(f"\n{'='*60}")
        print(f"# {spun.title}\n")
        print(spun.script)
        print(f"{'='*60}")
        print(f"\nStyle: {spun.style}")
        print(f"Key points: {len(spun.key_points)}")

    elif args.command == "combine":
        if not args.query:
            print("Error: --query required for 'combine' command")
            return
        topic = args.topic or args.query
        combined = ai.combine_videos_script(
            query=args.query,
            topic=topic,
            style=args.style,
            num_videos=args.num_videos
        )
        print(f"\n{'='*60}")
        print(f"# {combined.title}\n")
        print(combined.script)
        print(f"{'='*60}")
        print(f"\nStyle: {combined.style}")


if __name__ == "__main__":
    main()
