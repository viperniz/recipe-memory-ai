"""
Run FastAPI backend server
"""
import uvicorn
from pathlib import Path
from dotenv import load_dotenv

# Load .env from project root
load_dotenv(Path(__file__).parent / ".env")

if __name__ == "__main__":
    import os
    port = int(os.getenv('API_PORT', '8000'))
    uvicorn.run("src.api:app", host="0.0.0.0", port=port, reload=True)
