# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Video Memory AI - An AI system that processes videos (YouTube or local), extracts structured information using AI vision and transcription, stores in searchable memory, and provides content creation tools for generating new scripts.

## Architecture

```
Video/URL → Video Processor → Whisper (transcription) → Content Analyzer (LLM) → VectorMemory (SQLAlchemy/pgvector)
                           ↓                                                            ↓
                     Frame Analysis (GPT-4o Vision)                              RAG Search/Retrieval
                                                                                        ↓
                                                                              Content Creator Tools
                                                                              (Top 10 Scripts, Spinning)
```

## Key Components

- `src/video_processor.py` - Downloads videos (yt-dlp), extracts frames (OpenCV)
- `src/transcriber.py` - Audio transcription using OpenAI Whisper (runs locally)
- `src/content_analyzer.py` - Extracts structured content using LLM (OpenAI or Ollama)
- `src/vector_memory.py` - Vector database storage using SQLAlchemy/pgvector
- `src/content_creator.py` - Content creation tools (Top 10 scripts, content spinning)
- `src/speaker_diarization.py` - Speaker detection in multi-speaker videos
- `src/app.py` - Main application orchestrator and CLI
- `src/api.py` - REST API server

## Commands

```bash
# Install dependencies
pip install -r requirements.txt

# Install ffmpeg (required for audio extraction)
# Windows: choco install ffmpeg  OR  winget install ffmpeg
# Mac: brew install ffmpeg
# Linux: sudo apt install ffmpeg

# Run web UI
python run.py ui

# Run API server
python run_api.py

# CLI commands - Video Processing
python run.py add --source "https://youtube.com/watch?v=..."
python run.py add --source video.mp4 --no-frames  # Skip frame analysis
python run.py search --query "Italian pasta"
python run.py ask --query "How do I make carbonara?"
python run.py list
python run.py get --id content_20240101_120000

# CLI commands - Content Creation
python run.py top10 --topic "Python Tips" --query "python programming" --num-items 10
python run.py spin --id content_20240101_120000 --style entertaining
python run.py combine --query "cooking tips" --topic "Kitchen Hacks" --style casual

# Style options: casual, professional, educational, entertaining

# Use Ollama instead of OpenAI (fully local)
python run.py add --source video.mp4 --provider ollama
```

## Content Creation Features

### Top 10 Script Generator
Analyzes multiple videos on a topic and creates ranked "Top 10" style scripts:
- Automatically ranks key insights across videos
- Generates engaging intro and outro
- Includes source attribution

### Content Spinner
Rewrites existing content in different styles:
- **casual**: Friendly, conversational tone
- **professional**: Formal, authoritative
- **educational**: Clear explanations, beginner-friendly
- **entertaining**: Humorous, high energy

### Video Combiner
Merges insights from multiple videos into one cohesive script.

## Environment Variables

- `OPENAI_API_KEY` - Required for OpenAI provider

## Data Storage

- `data/videos/` - Downloaded video files
- `data/extracts/` - Extracted content JSON files
- `data/scripts/` - Generated Top 10 scripts
- `data/spun/` - Spun/reworded content
- `data/` - SQLite database (dev) or PostgreSQL (production) for vector storage
