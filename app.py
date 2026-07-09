import os
import uvicorn
from backend.main import app

if __name__ == "__main__":
    # Get port from environment, fallback to 7860 for Hugging Face Spaces
    port = int(os.environ.get("PORT", 7860))
    print(f"Starting server on port {port}...")
    uvicorn.run("backend.main:app", host="0.0.0.0", port=port, reload=False)
