"""
Speaker Diarization Module
Identifies who is speaking when using pyannote-audio
"""

import os
from pathlib import Path
from typing import List, Dict, Optional
import torch

# Ensure .env is loaded
try:
    from dotenv import load_dotenv
    # Load from project root
    env_path = Path(__file__).parent.parent / ".env"
    if env_path.exists():
        load_dotenv(env_path)
except ImportError:
    pass


class SpeakerDiarizer:
    def __init__(self, hf_token: str = None):
        """
        Initialize speaker diarization pipeline.
        
        Args:
            hf_token: HuggingFace token for model access.
                      Either set HF_TOKEN env var or run `hf auth login`
        """
        # Try multiple ways to get the token
        self.hf_token = hf_token or os.environ.get("HF_TOKEN") or os.environ.get("HUGGINGFACE_TOKEN")
        
        # Try to get token from huggingface_hub (set by `hf auth login`)
        if not self.hf_token:
            try:
                from huggingface_hub import HfFolder
                self.hf_token = HfFolder.get_token()
            except Exception:
                pass
        
        self.pipeline = None
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        
        if self.hf_token:
            print(f"HuggingFace token found: {self.hf_token[:10]}...")
        else:
            print("Warning: No HuggingFace token found")
        
    def _load_pipeline(self):
        """Lazy load the diarization pipeline"""
        if self.pipeline is None:
            print("Loading speaker diarization model (first time may take a minute)...")
            
            try:
                from pyannote.audio import Pipeline
                
                # Load pipeline with token
                self.pipeline = Pipeline.from_pretrained(
                    "pyannote/speaker-diarization-3.1",
                    token=self.hf_token  # New API uses 'token' instead of 'use_auth_token'
                )
                
                if self.device == "cuda":
                    self.pipeline = self.pipeline.to(torch.device("cuda"))
                    
                print(f"Speaker diarization model loaded (using {self.device})")
                
            except Exception as e:
                error_msg = str(e).lower()
                if "401" in str(e) or "token" in error_msg or "auth" in error_msg or "access" in error_msg:
                    raise RuntimeError(
                        "HuggingFace authentication required for speaker diarization.\n"
                        "Run: hf auth login\n"
                        "And accept terms at: https://huggingface.co/pyannote/speaker-diarization-3.1"
                    )
                raise
    
    def diarize(self, audio_path: str) -> List[Dict]:
        """
        Perform speaker diarization on audio file.
        
        Args:
            audio_path: Path to audio/video file
            
        Returns:
            List of segments: [{start, end, speaker}]
        """
        self._load_pipeline()
        
        print(f"Detecting speakers in: {audio_path}")
        
        # Run diarization
        diarization = self.pipeline(audio_path)
        
        # Convert to list of segments
        segments = []
        for turn, _, speaker in diarization.itertracks(yield_label=True):
            segments.append({
                "start": turn.start,
                "end": turn.end,
                "speaker": speaker
            })
        
        # Count unique speakers
        speakers = set(s["speaker"] for s in segments)
        print(f"Detected {len(speakers)} speakers")
        
        return segments
    
    def merge_with_transcript(
        self,
        transcript_segments: List[Dict],
        speaker_segments: List[Dict]
    ) -> List[Dict]:
        """
        Merge transcript segments with speaker labels.
        
        Args:
            transcript_segments: Whisper segments [{start, end, text}]
            speaker_segments: Diarization segments [{start, end, speaker}]
            
        Returns:
            Merged segments [{start, end, text, speaker}]
        """
        merged = []
        
        for t_seg in transcript_segments:
            t_start = t_seg.get("start", 0)
            t_end = t_seg.get("end", t_start)
            t_mid = (t_start + t_end) / 2
            
            # Find which speaker is talking at the midpoint of this segment
            speaker = "Unknown"
            for s_seg in speaker_segments:
                if s_seg["start"] <= t_mid <= s_seg["end"]:
                    speaker = s_seg["speaker"]
                    break
            
            merged.append({
                "start": t_start,
                "end": t_end,
                "text": t_seg.get("text", ""),
                "speaker": speaker
            })
        
        return merged


def diarize_audio(audio_path: str, hf_token: str = None) -> List[Dict]:
    """Convenience function to diarize audio"""
    diarizer = SpeakerDiarizer(hf_token)
    return diarizer.diarize(audio_path)


if __name__ == "__main__":
    import sys
    
    if len(sys.argv) > 1:
        audio_path = sys.argv[1]
        segments = diarize_audio(audio_path)
        
        print(f"\nFound {len(segments)} speaker segments:")
        for seg in segments[:10]:
            print(f"  [{seg['start']:.1f}s - {seg['end']:.1f}s] {seg['speaker']}")
        if len(segments) > 10:
            print(f"  ... and {len(segments) - 10} more")
