"""
FluentIQ — AI Pronunciation Coach API

FastAPI application that:
  - Serves the frontend as static files
  - Accepts audio uploads (30–45 seconds, English)
  - Analyses pronunciation using faster-whisper + Groq
  - Returns scores and per-word feedback
  - Deletes audio from memory immediately after analysis (DPDP)
"""

from dotenv import load_dotenv
load_dotenv()

import io
import logging
import os
import tempfile

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydub import AudioSegment

from backend.analyzer import PronunciationAnalyzer

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s  %(message)s",
)
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------
app = FastAPI(
    title="FluentIQ — AI Pronunciation Coach",
    description="Upload or record English speech and get instant pronunciation feedback.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Globals
# ---------------------------------------------------------------------------
analyzer: PronunciationAnalyzer | None = None

MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB
MIN_DURATION_S = 30
MAX_DURATION_S = 45

FRONTEND_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend")

# ---------------------------------------------------------------------------
# Lifecycle
# ---------------------------------------------------------------------------
@app.on_event("startup")
async def _startup():
    global analyzer
    logger.info("Initialising PronunciationAnalyzer …")
    analyzer = PronunciationAnalyzer()
    logger.info("Ready.")


# ---------------------------------------------------------------------------
# Routes — Frontend
# ---------------------------------------------------------------------------
@app.get("/")
async def index():
    return FileResponse(os.path.join(FRONTEND_DIR, "index.html"))


# Mount static after the root route so "/" resolves to index.html
app.mount("/static", StaticFiles(directory=FRONTEND_DIR), name="static")


# ---------------------------------------------------------------------------
# Routes — API
# ---------------------------------------------------------------------------
@app.get("/api/health")
async def health():
    return {"status": "healthy", "model": os.environ.get("WHISPER_MODEL", "base")}


@app.post("/api/analyze")
async def analyze_audio(audio: UploadFile = File(...)):
    """
    Accept an audio file, validate it, analyse pronunciation, and return results.
    The audio is processed entirely in-memory and deleted immediately after.
    """

    # --- Read bytes --------------------------------------------------------
    audio_bytes = await audio.read()

    if len(audio_bytes) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=400,
            detail=f"File too large ({len(audio_bytes) / 1024 / 1024:.1f} MB). Maximum is 10 MB.",
        )

    # --- Validate format & duration ----------------------------------------
    try:
        audio_seg = AudioSegment.from_file(io.BytesIO(audio_bytes))
        duration_s = len(audio_seg) / 1000.0
    except Exception:
        raise HTTPException(
            status_code=400,
            detail="Could not read audio file. Please upload a valid audio file (WAV, MP3, WebM, M4A, OGG).",
        )

    if duration_s < MIN_DURATION_S:
        raise HTTPException(
            status_code=400,
            detail=f"Audio is too short ({duration_s:.1f}s). Please record at least {MIN_DURATION_S} seconds.",
        )
    if duration_s > MAX_DURATION_S:
        raise HTTPException(
            status_code=400,
            detail=f"Audio is too long ({duration_s:.1f}s). Maximum is {MAX_DURATION_S} seconds.",
        )

    # --- Convert to WAV in a temp file for faster-whisper ------------------
    tmp_path = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tmp:
            tmp_path = tmp.name
            audio_seg.export(tmp, format="wav")

        # --- Run analysis --------------------------------------------------
        result = analyzer.analyze(tmp_path)
        return result

    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Analysis failed")
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")
    finally:
        # DPDP: delete audio immediately
        if tmp_path and os.path.exists(tmp_path):
            os.unlink(tmp_path)
        del audio_bytes
        logger.info("Audio data deleted from memory and disk.")
