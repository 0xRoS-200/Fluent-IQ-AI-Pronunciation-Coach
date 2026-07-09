# FluentIQ — AI-Powered Pronunciation Coach

**Live Demo:** [https://triumphant-possibility-production-a8a8.up.railway.app](https://triumphant-possibility-production-a8a8.up.railway.app)

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

## Deploy to Railway

1. Install the Railway CLI: `npm install -g @railway/cli`
2. Login to your Railway account: `railway login`
3. Create an Empty Service in your Railway project dashboard.
4. Link your local project: `railway link` (and choose the service)
5. Set environment variable: `GROQ_API_KEY` = your Groq key in the service settings
6. Deploy: `railway up`

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
