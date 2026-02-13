# 🎬 Video Memory AI

An AI system that watches videos, extracts structured information, and stores it in a searchable long-term memory.

## Features

- **Video Processing**: Download from YouTube or use local video files
- **Speech Recognition**: Transcribe audio using OpenAI Whisper (runs locally)
- **Vision Analysis**: Analyze video frames to understand visual content
- **Information Extraction**: Convert videos into structured data with key points, entities, action items, and more
- **Long-term Memory**: Store content in a vector database for semantic search
- **Natural Language Queries**: Ask questions about your video collection

## What Gets Extracted

- **Title & Summary**: Auto-generated from content
- **Key Points**: Main insights with timestamps
- **Entities**: People, products, tools, companies, concepts mentioned
- **Action Items**: Actionable takeaways
- **Quotes**: Notable statements
- **Resources**: Links, tools, and references mentioned
- **Topics & Tags**: For easy searching

## Quick Start

### 1. Install Dependencies

```bash
cd video-memory-ai
pip install -r requirements.txt
```

### 2. Install FFmpeg

**Windows (using Chocolatey):**
```bash
choco install ffmpeg
```

**Windows (using winget):**
```bash
winget install ffmpeg
```

### 3. Set Up API Key (for OpenAI)

```bash
# Copy example env file
copy .env.example .env

# Edit .env and add your OpenAI API key
```

Or use Ollama for fully local operation (no API key needed):
```bash
# Install Ollama from https://ollama.ai
ollama pull llama3.1
ollama pull llava
```

### 4. Run the Web UI

```bash
python run.py ui
```

Open http://localhost:7860 in your browser.

## Usage

### Web Interface

1. **Setup Tab**: Initialize the AI with your preferred settings
2. **Add Video Tab**: Paste a YouTube URL or video path
3. **Search Tab**: Find content by description or topics
4. **Ask Tab**: Ask natural language questions about your videos
5. **Library Tab**: Browse all stored content

### Command Line

```bash
# Add a video
python run.py add --source "https://youtube.com/watch?v=..."

# Search content
python run.py search --query "AI automation techniques"

# Ask a question
python run.py ask --query "What are the key takeaways from my videos?"

# List all content
python run.py list

# Use local LLM (Ollama)
python run.py add --source video.mp4 --provider ollama --no-frames
```

## Configuration Options

| Option | Description | Default |
|--------|-------------|---------|
| `--provider` | LLM provider: `openai` or `ollama` | openai |
| `--whisper` | Whisper model: `tiny`, `base`, `small`, `medium` | base |
| `--no-frames` | Skip frame analysis (faster, less accurate) | False |

## System Requirements

- **CPU**: Any modern CPU (i5 or better recommended)
- **RAM**: 8GB minimum, 16GB recommended
- **Storage**: ~2GB for models and data
- **GPU**: Not required (runs on CPU)

## Costs

- **Fully Local (Ollama)**: Free
- **OpenAI API**: ~$0.01-0.10 per video processed

## Project Structure

```
video-memory-ai/
├── src/
│   ├── video_processor.py  # Video download and frame extraction
│   ├── transcriber.py      # Whisper transcription
│   ├── content_analyzer.py # LLM content extraction
│   ├── content_memory.py   # ChromaDB vector storage
│   ├── app.py              # Main application
│   └── web_ui.py           # Gradio interface
├── data/
│   ├── videos/             # Downloaded videos
│   ├── extracts/           # Extracted content JSONs
│   └── memory/             # Vector database
├── requirements.txt
├── run.py
└── README.md
```

## License

MIT
