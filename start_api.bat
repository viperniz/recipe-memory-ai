@echo off
echo Starting Video Memory AI API Server...
echo Using Python 3.10 for compatibility
cd /d "%~dp0"
"C:\Users\tiess\AppData\Local\Programs\Python\Python310\python.exe" -m uvicorn src.api:app --host 0.0.0.0 --port 8000 --reload
pause
