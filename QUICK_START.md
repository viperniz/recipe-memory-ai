# Quick Start - React Frontend

## 🚀 Fast Setup (2 Steps)

### Step 1: Install Backend Dependencies
```bash
pip install fastapi uvicorn[standard]
```

### Step 2: Start Both Servers

**Option A: Manual (2 terminals)**

**Terminal 1 - Backend:**
```bash
python run_api.py
```
Wait for: `INFO:     Uvicorn running on http://0.0.0.0:8000`

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```
Wait for: `Local: http://localhost:3000/`

**Then open:** http://localhost:3000

---

## ✅ Test It Works

1. **Search:** Type "AI tutorials" and click Search
2. **Click a video:** Click any video card → it should add to queue immediately
3. **Watch progress:** See it in the Processing Queue section

---

## 🐛 Troubleshooting

**Backend error?**
- Make sure you're in project root: `python run_api.py`
- Install deps: `pip install -r requirements.txt`

**Frontend error?**
- Make sure you're in `frontend` folder: `cd frontend`
- Install deps: `npm install`

**Videos not adding?**
- Check browser console (F12)
- Check backend terminal for errors
- Make sure both servers are running

---

## 📝 What Changed

- ✅ **Backend:** FastAPI on port 8000
- ✅ **Frontend:** React on port 3000  
- ✅ **Clicking works:** No more Gradio JavaScript issues!
