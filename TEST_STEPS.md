# 🧪 How to Test the React Frontend

## Quick Test (3 Commands)

### 1️⃣ Install Backend Dependencies
```bash
pip install fastapi uvicorn[standard]
```

### 2️⃣ Start Backend (Terminal 1)
```bash
python run_api.py
```
✅ You should see: `INFO:     Uvicorn running on http://0.0.0.0:8000`

### 3️⃣ Start Frontend (Terminal 2 - NEW WINDOW)
```bash
cd frontend
npm run dev
```
✅ You should see: `Local: http://localhost:3000/`

---

## 🌐 Open Browser

Go to: **http://localhost:3000**

---

## ✅ Test the Features

### Test 1: Search Videos
1. Type a search query (e.g., "AI tutorials")
2. Click "🔍 Search" button
3. **Expected:** Video cards appear in a grid

### Test 2: Add Video to Queue ⭐ (THE MAIN TEST)
1. **Click on any video card** (the whole card is clickable)
2. **Expected:** 
   - Video immediately disappears from search results
   - Video appears in "Processing Queue" section
   - Status shows "queued" then "downloading" then "transcribing" etc.
   - Progress bar updates

### Test 3: Watch Progress
1. After adding a video, watch the queue
2. **Expected:**
   - Progress percentage increases
   - Status changes: queued → downloading → transcribing → processing → complete
   - Updates happen automatically every 2 seconds

---

## 🐛 If Something Doesn't Work

### Backend won't start?
```bash
# Check if dependencies are installed
pip list | findstr fastapi

# If not, install:
pip install fastapi uvicorn[standard]
```

### Frontend won't start?
```bash
cd frontend
npm install
npm run dev
```

### Videos not adding when clicked?
1. **Open browser console** (F12 → Console tab)
2. **Click a video**
3. **Check for errors** - you should see:
   - `Video added to queue: {job_id: "..."}`
   - If you see errors, copy them

4. **Check backend terminal** - you should see:
   - `[PYTHON] ===== add_single_video_to_queue called =====`
   - `[PYTHON] Video found: ...`
   - `[PYTHON] ✓ Video added successfully!`

### CORS errors?
- Make sure backend is on port 8000
- Make sure frontend is on port 3000
- Both should be running simultaneously

---

## 📊 What You Should See

**When it's working:**
- ✅ Click video → instant feedback (video disappears from search)
- ✅ Video appears in queue immediately
- ✅ Progress updates in real-time
- ✅ No errors in browser console
- ✅ No errors in backend terminal

**If it's NOT working:**
- ❌ Click video → nothing happens
- ❌ Errors in browser console
- ❌ Errors in backend terminal
- ❌ Videos don't disappear from search

---

## 🎯 Success Criteria

**The main test:** Click a video card → it should:
1. Disappear from search results immediately
2. Appear in processing queue
3. Start processing automatically

If this works, **you're done!** 🎉
