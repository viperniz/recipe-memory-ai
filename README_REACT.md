# Video Memory AI - React Frontend

## Setup

### Backend (FastAPI)
```bash
# Install dependencies
pip install -r requirements.txt

# Run backend
python run_api.py
```

Backend runs on http://localhost:8000

### Frontend (React)
```bash
cd frontend

# Install dependencies
npm install

# Run dev server
npm run dev
```

Frontend runs on http://localhost:3000

## Architecture

- **Backend**: FastAPI (Python) - handles video processing, YouTube search, job management
- **Frontend**: React + Vite - clean, modern UI with reliable click handling
- **API**: REST endpoints for all operations

## Features

- ✅ YouTube search
- ✅ Click videos to add to queue (ACTUALLY WORKS!)
- ✅ Real-time job status updates
- ✅ Processing queue display
- ✅ Settings (LLM provider, Whisper model, Vision AI)
