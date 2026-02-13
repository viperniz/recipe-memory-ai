import subprocess
import sys
import os

# Add ffmpeg paths
paths_to_add = [
    r"C:\Users\tiess\miniconda3\envs\recipe-ai\Library\bin",
    r"C:\Users\tiess\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-8.0.1-full_build\bin",
]

for p in paths_to_add:
    if os.path.exists(p):
        os.environ['PATH'] = p + os.pathsep + os.environ.get('PATH', '')
        print(f"Added to PATH: {p}")

# Test ffmpeg
result = subprocess.run(['ffmpeg', '-version'], capture_output=True, text=True)
if result.returncode == 0:
    print("FFmpeg OK:", result.stdout.split('\n')[0])
else:
    print("FFmpeg ERROR:", result.stderr)

# Test whisper
print("\nTesting Whisper...")
import whisper
print("Whisper imported OK")
