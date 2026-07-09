FROM python:3.11-slim

# Install ffmpeg (required by pydub for audio processing)
RUN apt-get update && \
    apt-get install -y --no-install-recommends ffmpeg && \
    rm -rf /var/lib/apt/lists/*

# Set cache environment variable for Hugging Face Spaces compatibility
ENV HF_HOME=/app/cache

WORKDIR /app

# Create cache directory and grant read/write/execute permissions to all users (for non-root users on Hugging Face)
RUN mkdir -p /app/cache && chmod -R 777 /app/cache

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Pre-download the Whisper model during build so startup is fast
RUN python -c "from faster_whisper import WhisperModel; WhisperModel('base', device='cpu', compute_type='int8')"

# Copy application code
COPY backend/ ./backend/
COPY frontend/ ./frontend/

# Expose ports for both Render (10000) and Hugging Face Spaces (7860)
EXPOSE 7860
EXPOSE 10000

# Use dynamic port assignment (Render sets $PORT, Hugging Face uses $PORT or default 7860)
CMD ["sh", "-c", "uvicorn backend.main:app --host 0.0.0.0 --port ${PORT:-7860}"]
