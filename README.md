# FluentIQ — AI-Powered Pronunciation Coach

Upload or record a 30–45 second English audio sample and get instant pronunciation feedback with word-level highlights, powered by open-source Whisper and Groq's Llama 3.3.

## ✨ Features

- 🎙️ **Upload or record** audio directly in the browser
- 📊 **Overall pronunciation score** (0–100) with accuracy, fluency, and clarity breakdowns
- 🔍 **Word-level highlights** — green (good), yellow (needs work), red (mispronounced)
- 💡 **Actionable feedback** — specific tips per flagged word using Groq AI
- 🔒 **DPDP compliant** — audio processed in-memory, never stored, deleted immediately
- 🌐 **Zero setup** — works in any modern browser
- ⚡ **GSAP animations** — smooth 120fps transitions and interactive elements

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Backend | Python FastAPI |
| STT | faster-whisper (open-source, on-server) |
| Phoneme Analysis | CMU Pronouncing Dictionary |
| AI Feedback | Groq API (Llama 3.3 70B) |
| Frontend | Vanilla HTML/CSS/JS + GSAP |
| Deployment | Docker + Render |

## Quick Start (Local)

### Prerequisites
- Python 3.10+
- ffmpeg installed (`choco install ffmpeg` on Windows, `brew install ffmpeg` on macOS)
- [Groq API key](https://console.groq.com) (free tier)

### Setup

```bash
# Clone and enter the project
cd Livo

# Create virtual environment
python -m venv venv
venv\Scripts\activate  # Windows
# source venv/bin/activate  # macOS/Linux

# Install dependencies
pip install -r requirements.txt

# Set your Groq API key in .env
# Edit the .env file and replace your_groq_api_key_here with your actual key

# Run the app
uvicorn backend.main:app --reload --port 8000
```

Open http://localhost:8000 in your browser.

## Deploy to Render

1. Push this repo to GitHub
2. Create a new **Web Service** on [Render](https://render.com)
3. Connect your GitHub repo
4. Render will auto-detect the `Dockerfile`
5. Add environment variable: `GROQ_API_KEY` = your Groq key
6. Deploy!

## Architecture

See [docs/architecture.md](docs/architecture.md) for the full system architecture document.

## Privacy & DPDP Compliance

- Audio is processed **entirely on-server** by faster-whisper — no audio leaves the server
- Only extracted **text** is sent to Groq for feedback generation
- Audio is **deleted from memory immediately** after analysis
- No user accounts, no cookies, no tracking
- Full details in the [architecture document](docs/architecture.md)

## License

MIT
