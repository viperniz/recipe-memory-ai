# How to Test the React Frontend

## Step 1: Install Dependencies

### Backend Dependencies
```bash
pip install fastapi uvicorn[standard]
```

### Frontend Dependencies (already installed)
The frontend dependencies are already installed. If you need to reinstall:
```bash
cd frontend
npm install
```

## Step 2: Start the Backend Server

Open **Terminal 1**:
```bash
python run_api.py
```

You should see:
```
INFO:     Uvicorn running on http://0.0.0.0:8000
INFO:     Application startup complete.
```

The API will be available at: http://localhost:8000

## Step 3: Start the React Frontend

Open **Terminal 2** (new terminal window):
```bash
cd frontend
npm run dev
```

You should see:
```
  VITE v5.x.x  ready in xxx ms

  ➜  Local:   http://localhost:3000/
  ➜  Network: use --host to expose
```

## Step 4: Open in Browser

Open your browser and go to: **http://localhost:3000**

## Step 5: Test the Features

1. **Search for Videos:**
   - Type a search query (e.g., "AI tutorials")
   - Click "🔍 Search" or press Enter
   - You should see video results appear

2. **Add Video to Queue:**
   - **Click on any video card** (the whole card is clickable)
   - The video should immediately be added to the processing queue
   - You'll see it appear in the "Processing Queue" section

3. **Watch Progress:**
   - The queue updates every 2 seconds
   - You'll see progress percentage and status updates
   - Status changes: queued → downloading → transcribing → processing → complete

4. **Settings:**
   - Change LLM Provider, Whisper Model, or Vision AI settings
   - These apply to newly added videos

## Troubleshooting

### Backend won't start
- Make sure you're in the project root directory
- Check if port 8000 is already in use
- Install missing dependencies: `pip install -r requirements.txt`

### Frontend won't start
- Make sure you're in the `frontend` directory
- Run `npm install` if you see module errors
- Check if port 3000 is already in use

### Videos not adding
- Check browser console (F12) for errors
- Check backend terminal for error messages
- Make sure both servers are running

### CORS errors
- Make sure backend is running on port 8000
- Make sure frontend is running on port 3000
- Check that CORS is enabled in `src/api.py`

## Quick Test Commands

**Test backend is running:**
```bash
curl http://localhost:8000/
```

**Test API endpoint:**
```bash
curl http://localhost:8000/api/jobs
```

## What to Expect

✅ **Working:**
- Clicking videos adds them to queue
- Real-time job status updates
- Progress bars update automatically
- Videos disappear from search after adding

❌ **If something doesn't work:**
- Check both terminal windows for error messages
- Check browser console (F12 → Console tab)
- Make sure both servers are running
