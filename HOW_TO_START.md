# 🚀 How to Start the React Frontend

## Quick Start (Easiest)

**Double-click:** `START.bat`

This will:
1. Start the backend server (port 8000)
2. Start the frontend server (port 3000)
3. Open your browser automatically

---

## Manual Start (2 Terminals)

### Terminal 1 - Backend Server
```bash
python run_api.py
```
✅ Wait for: `INFO:     Uvicorn running on http://0.0.0.0:8000`

### Terminal 2 - Frontend Server
```bash
cd frontend
npm run dev
```
✅ Wait for: `Local: http://localhost:3000/`

### Then Open Browser
Go to: **http://localhost:3000**

---

## First Time Setup

If you haven't installed dependencies yet:

```bash
# Install backend dependencies
pip install fastapi uvicorn[standard]

# Install frontend dependencies (already done, but if needed)
cd frontend
npm install
```

---

## What You'll See

1. **Backend terminal:** Shows API requests and processing status
2. **Frontend terminal:** Shows Vite dev server
3. **Browser:** The React app with YouTube search

---

## Test It Works

1. Type a search query (e.g., "AI tutorials")
2. Click "🔍 Search"
3. **Click any video card** → Should add to queue immediately! ✅

---

## Troubleshooting

**Backend won't start?**
- Install: `pip install fastapi uvicorn[standard]`
- Check port 8000 isn't in use

**Frontend won't start?**
- Run: `cd frontend && npm install`
- Check port 3000 isn't in use

**Nothing happens when clicking videos?**
- Check browser console (F12)
- Check backend terminal for errors
- Make sure both servers are running
