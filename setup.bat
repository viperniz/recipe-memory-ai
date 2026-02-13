@echo off
echo ========================================
echo Recipe Memory AI - Setup Script
echo ========================================
echo.

REM Check if conda is available
where conda >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Conda not found in PATH
    echo Please run this from Anaconda Prompt or add conda to PATH
    pause
    exit /b 1
)

echo [1/4] Creating conda environment with Python 3.11...
call conda create -n recipe-ai python=3.11 -y
if %ERRORLEVEL% NEQ 0 (
    echo Environment may already exist, continuing...
)

echo.
echo [2/4] Activating environment...
call conda activate recipe-ai

echo.
echo [3/4] Installing dependencies...
pip install openai-whisper opencv-python chromadb openai yt-dlp ollama gradio python-dotenv rich pydantic

echo.
echo [4/4] Installing ffmpeg via conda...
call conda install -c conda-forge ffmpeg -y

echo.
echo ========================================
echo Setup complete!
echo ========================================
echo.
echo To use Recipe Memory AI:
echo   1. Open Anaconda Prompt
echo   2. Run: conda activate recipe-ai
echo   3. Run: cd %~dp0
echo   4. Run: python run.py ui
echo.
echo Don't forget to set up your API key:
echo   copy .env.example .env
echo   Then edit .env and add your OPENAI_API_KEY
echo.
pause
