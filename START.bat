@echo off
echo ========================================
echo   Video Memory AI - React Frontend
echo ========================================
echo.
echo Starting backend server...
echo.
start "Video Memory AI - Backend" cmd /k "python run_api.py"
timeout /t 3 /nobreak >nul
echo.
echo Starting frontend...
echo.
cd frontend
start "Video Memory AI - Frontend" cmd /k "npm run dev"
cd ..
echo.
echo ========================================
echo   Both servers are starting!
echo ========================================
echo.
echo Backend:  http://localhost:8000
echo Frontend: http://localhost:3000
echo.
echo Opening browser in 5 seconds...
timeout /t 5 /nobreak >nul
start http://localhost:3000
echo.
pause
