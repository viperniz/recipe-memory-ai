#!/usr/bin/env python3
"""
Video Memory AI - Quick Start Script
"""

import sys
import os
from pathlib import Path

# Add ffmpeg to PATH
def setup_ffmpeg_path():
    """Add ffmpeg to PATH from conda or winget"""
    possible_paths = [
        Path(os.environ.get('CONDA_PREFIX', '')) / 'Library' / 'bin',
        Path(os.environ.get('USERPROFILE', '')) / 'miniconda3' / 'envs' / 'recipe-ai' / 'Library' / 'bin',
        Path('C:/Users/tiess/miniconda3/envs/recipe-ai/Library/bin'),
        # Winget ffmpeg
        Path(os.environ.get('LOCALAPPDATA', '')) / 'Microsoft' / 'WinGet' / 'Packages' / 'Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe' / 'ffmpeg-8.0.1-full_build' / 'bin',
    ]

    for p in possible_paths:
        ffmpeg_exe = p / 'ffmpeg.exe' if sys.platform == 'win32' else p / 'ffmpeg'
        if p.exists() and ffmpeg_exe.exists():
            current_path = os.environ.get('PATH', '')
            if str(p) not in current_path:
                os.environ['PATH'] = str(p) + os.pathsep + current_path
                print(f"Added to PATH: {p}")
            return True
    print("Warning: ffmpeg not found in expected locations")
    return False

setup_ffmpeg_path()

# Add src to path
sys.path.insert(0, str(Path(__file__).parent / "src"))

# Load environment variables
from dotenv import load_dotenv
env_path = Path(__file__).parent / ".env"
load_dotenv(env_path)
print(f"Loaded .env from: {env_path}") if env_path.exists() else None


def main():
    # Check if user is trying to run the old UI
    if len(sys.argv) > 1 and sys.argv[1] == "ui":
        print("\n" + "="*60)
        print("  The Gradio UI has been replaced with React!")
        print("="*60)
        print("\nTo start the web interface:")
        print("\n  1. Backend (Terminal 1):")
        print("     python run_api.py")
        print("\n  2. Frontend (Terminal 2):")
        print("     cd frontend")
        print("     npm run dev")
        print("\n  Or just double-click: START.bat")
        print("\n  Then open: http://localhost:3000")
        print("\n" + "="*60 + "\n")
        return
    
    # Run CLI mode
    from app import main as cli_main
    cli_main()


if __name__ == "__main__":
    main()
