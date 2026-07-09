FROM python:3.11-slim

# Install ffmpeg (required by pydub for audio processing)
RUN apt-get update && \
    apt-get install -y --no-install-recommends ffmpeg && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Pre-download the Whisper model during build so startup is fast
RUN python -c "from faster_whisper import WhisperModel; WhisperModel('base', device='cpu', compute_type='int8')"

# Copy application code
COPY backend/ ./backend/
COPY frontend/ ./frontend/

# Expose port for local and Railway/Render deployment
EXPOSE 8080

# Use dynamic port assignment (Railway/Render sets $PORT, default to 8080)
CMD ["sh", "-c", "uvicorn backend.main:app --host 0.0.0.0 --port ${PORT:-8080}"]

