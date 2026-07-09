# FluentIQ — System Architecture Document

## 1. Overview

FluentIQ is a web application that assesses English pronunciation from audio recordings. A user uploads (or records) a 30–45 second audio clip, and the system returns an overall pronunciation score along with word-level feedback highlighting specific mistakes.

```
┌─────────────────────────────────────────────────────────────────┐
│                        Browser (Frontend)                       │
│                                                                 │
│  ┌──────────────┐   ┌──────────────┐   ┌─────────────────────┐  │
│  │  DPDP        │   │  Upload /    │   │  Results:           │  │
│  │  Consent     │──▷│  Record      │──▷│  Score Gauge +      │  │
│  │  Modal       │   │  Audio       │   │  Word Highlights    │  │
│  └──────────────┘   └──────┬───────┘   └─────────────────────┘  │
│                            │                      ▲              │
└────────────────────────────┼──────────────────────┼──────────────┘
                             │ POST /api/analyze    │ JSON
                             ▼                      │
┌────────────────────────────┼──────────────────────┼──────────────┐
│                    FastAPI Backend (Render)        │              │
│                            │                      │              │
│  ┌─────────────────────────▼──────────────────────┴───────────┐  │
│  │                   Analysis Pipeline                         │  │
│  │                                                             │  │
│  │  1. Validate format & duration (30–45s)                     │  │
│  │  2. Transcribe with faster-whisper (local, on-server)       │  │
│  │     → word timestamps + token probabilities                 │  │
│  │  3. Score each word (probability → 0–100 score)             │  │
│  │  4. Phoneme lookup (CMU Pronouncing Dictionary)             │  │
│  │  5. Generate feedback via Groq (Llama 3.3 70B, text only)  │  │
│  │  6. Return results → DELETE audio from memory               │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                                                                   │
│  External call (text only):   ┌─────────────────────────┐        │
│  ─────────────────────────────▶  Groq API               │        │
│                                │  Llama 3.3 70B          │        │
│                                │  (pronunciation tips)   │        │
│                                └─────────────────────────┘        │
└───────────────────────────────────────────────────────────────────┘
```

## 2. Components & Connections

### Frontend (Vanilla HTML/CSS/JS)
- **Consent modal** — blocks all functionality until the user accepts the DPDP-compliant privacy notice
- **Upload zone** — drag-and-drop or file picker; validates audio duration client-side before upload
- **Browser recording** — MediaRecorder API captures audio; auto-stops at 45 seconds
- **Results view** — animated score gauge (SVG), color-coded word chips with hover tooltips, detailed feedback cards
- Served as static files by the FastAPI backend

### Backend (Python FastAPI)
- **`main.py`** — HTTP server, routes, file validation (format, size ≤ 10 MB, duration 30–45s)
- **`analyzer.py`** — orchestrates the pipeline: Whisper → scoring → phonemes → Groq → response
- **`scoring.py`** — maps Whisper word probabilities to 0–100 scores with fluency and completeness metrics
- **`phoneme_utils.py`** — CMU Dict lookups, identifies phonemes commonly difficult for English learners

### External Services
| Service | What it does | Data sent |
|---------|-------------|-----------|
| **Groq API** (Llama 3.3 70B) | Generates human-readable pronunciation tips | **Text only** — transcript + confidence scores. No audio. |

No other external services are used. Whisper and CMU Dict run entirely on-server.

## 3. Models & APIs — Why These Choices

### faster-whisper (open-source Whisper via CTranslate2)
- **Why Whisper?** State-of-the-art English speech recognition; its word-level confidence probabilities are a strong signal for pronunciation quality — low confidence = the model struggled to recognise the word, which correlates with unclear pronunciation.
- **Why faster-whisper?** 4× faster than OpenAI's vanilla `whisper` package, lower memory via int8 quantisation, and provides word timestamps with probabilities out of the box.
- **Why not the OpenAI Whisper API?** Requires sending audio externally (DPDP concern), costs money per request, and doesn't expose token-level log probabilities.
- **Why not Azure Pronunciation Assessment?** Purpose-built but adds Azure vendor lock-in and credential management. Our approach is portable and transparent.

### Groq (Llama 3.3 70B Versatile)
- **Why an LLM for feedback?** Rule-based feedback is generic ("pronounce this word better"). An LLM produces specific, contextualised tips ("the 'th' in 'think' sounds like 't' — try placing your tongue between your teeth").
- **Why Groq?** Inference at ~500 tokens/sec (fastest available), generous free tier (30 req/min), and runs open models (no vendor lock-in on the model itself).
- **Why Llama 3.3 70B?** Best quality-to-speed ratio among open models for structured feedback generation.
- **Why not GPT-4o?** Adds OpenAI dependency and cost. Llama 3.3 produces comparable quality for this structured task.

### CMU Pronouncing Dictionary
- **Why?** Free, offline, gold-standard English phoneme dictionary. Enables phoneme-level analysis (identifying which specific sounds are difficult) without any API calls.

## 4. How Pronunciation Scoring Works

### Word-Level Scoring (Primary Signal)
Each word from faster-whisper comes with a `probability` (0.0–1.0) representing how confidently the model recognised it. We map this non-linearly to a 0–100 score:

| Whisper Probability | Score Range | Rating |
|---|---|---|
| ≥ 0.95 | 95–100 | 🟢 Good |
| 0.85–0.95 | 80–95 | 🟢 Good |
| 0.70–0.85 | 60–80 | 🟡 Fair |
| 0.50–0.70 | 40–60 | 🟡 Fair |
| < 0.50 | 0–40 | 🔴 Poor |

**Why this works:** STT models are trained on clear speech. When a word is mispronounced, the acoustic features don't match learned patterns, causing the model to assign lower confidence. This is an empirically validated proxy for pronunciation quality.

### Overall Score
```
overall = (avg_word_scores × 0.60) + (fluency × 0.20) + (completeness × 0.20)
```
- **Fluency** (20%): Derived from inter-word gap analysis. Natural English has ~0.1–0.4s gaps; long pauses reduce the score.
- **Completeness** (20%): Ratio of words rated "good" to total words.

### What Gets Highlighted
- Words scoring **< 80** are highlighted (yellow for "fair", red for "poor")
- Each highlighted word shows:
  - The specific issue type (mispronunciation, unclear, rushed, hesitation)
  - Actionable feedback from the LLM
  - Expected phonemes from CMU Dict
  - Common confusion patterns for that phoneme

## 5. DPDP Compliance

The Digital Personal Data Protection Act 2023 (India) classifies voice recordings as personal data. Here is how FluentIQ complies:

| DPDP Requirement | Implementation |
|---|---|
| **Lawful purpose & consent (§4–6)** | Explicit consent modal shown before any audio processing. User must actively check a consent box. Processing purpose is clearly stated. |
| **Data minimisation (§4(2))** | Only audio is collected — no name, email, or account. Only the minimum data needed for analysis. |
| **Storage & retention (§8)** | **Zero retention.** Audio is held in-memory only during the ~15 second analysis window. Immediately deleted (`os.unlink()` + `del`) after. No database, no file system persistence. |
| **Purpose limitation (§5)** | Audio is used exclusively for pronunciation analysis. Never used for model training or any other purpose. |
| **Data residency** | Audio is processed on the deployment server (Render, US/EU region). Audio **never leaves the server** — only extracted text is sent to Groq (US). This is transparently disclosed in the consent modal. |
| **Right to erasure (§12)** | Nothing to erase — no data is persisted. This is stated clearly in the privacy notice. |
| **Data breach notification (§8(6))** | Minimal breach surface since no data is stored. Architecture is documented for audit. |
| **Grievance redressal (§13)** | Contact email provided in the app footer for data-related queries. |
| **Children's data (§9)** | No age verification implemented (trade-off acknowledged; would add for production). |

### Data Flow Diagram (DPDP Perspective)
```
User Audio → [In-Memory Buffer] → faster-whisper (on-server) → Text + Scores
                  │                                                    │
                  │ ❌ NEVER stored to disk                            │
                  │ ❌ NEVER sent externally                           ▼
                  │                                          Groq API (text only)
                  │                                                    │
                  ▼                                                    ▼
            DELETED immediately                              Feedback text returned
            (os.unlink + del)                                to browser and displayed
```

## 6. Trade-offs & What We'd Build Next

### Trade-offs Made

| Decision | Trade-off | Rationale |
|---|---|---|
| Whisper `base` model on CPU | ~10–15s processing for 40s audio (vs. <2s on GPU) | Avoids GPU hosting cost (~$50/mo). Acceptable for demo. |
| Confidence-based scoring | Not true phoneme-by-phoneme assessment | Simpler to implement, surprisingly effective. Azure's API would be more granular but adds vendor lock-in. |
| No reference passage | Score is relative (STT confidence), not absolute | Allows open-ended speech vs. read-aloud only. Would add read-along mode as enhancement. |
| No user accounts | No progress tracking over time | Simplifies DPDP (zero data storage) and reduces scope. |
| Groq free tier | 30 req/min rate limit | Sufficient for demo/evaluation; would use paid tier for production. |

### With Another Week
1. **Reference passage mode** — user reads a given text; compare against TTS-generated reference using Dynamic Time Warping for phoneme-level alignment
2. **GPU deployment** (Fly.io GPU or Modal) for sub-2 second processing
3. **Whisper `small` or `medium` model** for improved accuracy
4. **Phoneme-level IPA visualization** — show exactly which sound was off
5. **Progress tracking** with optional (consented) user accounts and session history
6. **Real-time feedback** via WebSocket streaming during recording
7. **Age verification** for full DPDP children's data compliance
8. **India-region deployment** (AWS Mumbai or Azure Central India) for data residency
