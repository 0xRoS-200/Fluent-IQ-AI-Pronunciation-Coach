"""
Core pronunciation analysis pipeline.

Flow:
  1. Transcribe audio with faster-whisper (local, on-server)
  2. Score each word using Whisper confidence probabilities
  3. Look up phonemes from CMU Pronouncing Dictionary
  4. Send TEXT ONLY (no audio) to Groq Llama 3.3 for feedback
  5. Combine into structured response
  6. Audio is deleted by the caller immediately after this returns
"""

import json
import logging
import os

from faster_whisper import WhisperModel
from groq import Groq

from backend.scoring import (
    calculate_fluency_score,
    calculate_completeness_score,
    calculate_overall_score,
    calculate_word_scores,
)
from backend.phoneme_utils import get_phoneme_analysis, get_difficult_phoneme_summary

logger = logging.getLogger(__name__)


class PronunciationAnalyzer:
    """Stateful analyzer — loads Whisper model once at startup."""

    def __init__(self):
        model_size = os.environ.get("WHISPER_MODEL", "base")
        logger.info(f"Loading faster-whisper model '{model_size}' on CPU (int8) …")
        self.whisper = WhisperModel(model_size, device="cpu", compute_type="int8")
        logger.info("Whisper model loaded.")

        groq_key = os.environ.get("GROQ_API_KEY")
        if groq_key:
            self.groq = Groq(api_key=groq_key, timeout=10.0)
            logger.info("Groq client initialized with 10s timeout.")
        else:
            self.groq = None
            logger.warning("GROQ_API_KEY not set — LLM feedback will use fallback.")

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def analyze(self, audio_path: str) -> dict:
        """Run the full analysis pipeline. Returns a JSON-serializable dict."""

        # 1. Transcribe
        segments, info = self.whisper.transcribe(
            audio_path,
            word_timestamps=True,
            language="en",
        )

        words_raw: list[dict] = []
        for seg in segments:
            if seg.words:
                for w in seg.words:
                    words_raw.append(
                        {
                            "word": w.word.strip(),
                            "start": round(w.start, 2),
                            "end": round(w.end, 2),
                            "probability": round(w.probability, 4),
                        }
                    )

        if not words_raw:
            return {
                "overall_score": 0,
                "fluency_score": 0,
                "completeness_score": 0,
                "transcript": "",
                "duration": round(info.duration, 1),
                "words": [],
                "summary": "No speech was detected in the audio. Please try again with a clear English recording.",
                "tips": [
                    "Make sure you are speaking clearly into the microphone.",
                    "Reduce background noise.",
                ],
                "strengths": [],
                "difficult_phonemes": [],
            }

        # 2. Score words
        scored_words = calculate_word_scores(words_raw)

        # 3. Phoneme analysis
        for wd in scored_words:
            wd["phonemes"] = get_phoneme_analysis(wd["word"])

        # 4. Aggregate scores
        fluency = calculate_fluency_score(scored_words)
        completeness = calculate_completeness_score(scored_words)
        overall = calculate_overall_score(scored_words, fluency, completeness)

        # 5. LLM feedback (text only — audio never sent)
        feedback = self._get_feedback(scored_words)

        # 6. Merge per-word feedback
        if feedback.get("word_feedback"):
            word_fb_map = {
                wf["word"].lower().strip(): wf for wf in feedback["word_feedback"]
            }
            for wd in scored_words:
                match = word_fb_map.get(wd["word"].lower().strip())
                if match:
                    wd["feedback"] = match.get("feedback", "")
                    wd["issue_type"] = match.get("issue_type", "")

        # 7. Difficult phoneme summary
        difficult = get_difficult_phoneme_summary(scored_words)

        return {
            "overall_score": overall,
            "fluency_score": fluency,
            "completeness_score": completeness,
            "transcript": " ".join(w["word"] for w in scored_words),
            "duration": round(info.duration, 1),
            "words": scored_words,
            "summary": feedback.get("summary", ""),
            "tips": feedback.get("tips", []),
            "strengths": feedback.get("strengths", []),
            "difficult_phonemes": difficult,
        }

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    def _get_feedback(self, scored_words: list[dict]) -> dict:
        """Get human-readable feedback from Groq (Llama 3.3 70B)."""

        flagged = [w for w in scored_words if w["rating"] in ("fair", "poor")]

        if not flagged:
            return {
                "summary": (
                    "Excellent pronunciation! Every word was clearly articulated. "
                    "Keep up the great work."
                ),
                "strengths": [
                    "Clear articulation across all words",
                    "Good speaking pace and fluency",
                    "Consistent pronunciation quality",
                ],
                "tips": [
                    "Keep practising with more complex passages to maintain your skill.",
                    "Try reading aloud from news articles to expand vocabulary.",
                ],
                "word_feedback": [],
            }

        # Build context for the LLM
        word_info_lines = []
        for w in flagged:
            line = f'- "{w["word"]}" (score: {w["score"]}/100, rating: {w["rating"]}'
            ph = w.get("phonemes", {})
            if ph.get("arpabet"):
                line += f', expected phonemes: {ph["arpabet"]}'
            if ph.get("common_issues"):
                line += f', known difficulties: {"; ".join(ph["common_issues"][:2])}'
            line += ")"
            word_info_lines.append(line)

        transcript = " ".join(w["word"] for w in scored_words)
        total_words = len(scored_words)
        good_count = sum(1 for w in scored_words if w["rating"] == "good")

        prompt = f"""You are a friendly, encouraging English pronunciation coach.

A learner recorded themselves speaking English. A speech-to-text model transcribed the audio and assigned confidence scores to each word. Lower scores mean the model had trouble recognising the word, which usually indicates a pronunciation issue.

**Transcript** ({total_words} words, {good_count} scored 'good'):
"{transcript}"

**Words flagged with potential pronunciation issues:**
{chr(10).join(word_info_lines)}

Respond in valid JSON with this exact structure:
{{
  "summary": "2-3 sentence overall assessment. Be encouraging but honest.",
  "strengths": ["2-3 specific things the speaker did well"],
  "tips": ["2-3 actionable general tips for improvement"],
  "word_feedback": [
    {{
      "word": "the exact flagged word",
      "issue_type": "mispronunciation | unclear | rushed | hesitation",
      "feedback": "1-2 sentences of specific, actionable advice. Include a phonetic tip where relevant."
    }}
  ]
}}

Rules:
- Only include word_feedback for the flagged words listed above.
- Be specific about likely phoneme errors based on common English-learner patterns.
- Keep advice practical — what should they physically do with their mouth/tongue.
- Do NOT invent words that aren't in the transcript."""

        if not self.groq:
            return self._fallback_feedback(flagged)

        try:
            completion = self.groq.chat.completions.create(
                messages=[{"role": "user", "content": prompt}],
                model="llama-3.3-70b-versatile",
                temperature=0.3,
                max_tokens=1024,
                response_format={"type": "json_object"},
            )
            text = completion.choices[0].message.content
            return json.loads(text)
        except Exception as e:
            logger.error(f"Groq API error: {e}")
            return self._fallback_feedback(flagged)

    @staticmethod
    def _fallback_feedback(flagged: list[dict]) -> dict:
        """Rule-based fallback when Groq is unavailable."""
        word_fb = []
        for w in flagged[:8]:
            tips = w.get("phonemes", {}).get("tips", [])
            tip_text = tips[0] if tips else "Try pronouncing this word more slowly and clearly."
            word_fb.append(
                {
                    "word": w["word"],
                    "issue_type": "unclear",
                    "feedback": f"Scored {w['score']}/100. {tip_text}",
                }
            )

        return {
            "summary": "Your recording was analysed successfully. Some words could use improvement — see the highlights below.",
            "strengths": ["Completed the full recording", "Most words were understandable"],
            "tips": [
                "Slow down slightly on highlighted words.",
                "Practise difficult sounds in isolation before using them in sentences.",
            ],
            "word_feedback": word_fb,
        }
