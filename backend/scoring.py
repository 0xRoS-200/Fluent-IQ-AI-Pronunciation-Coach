"""
Pronunciation scoring engine.

Maps faster-whisper word probabilities (0.0–1.0) to human-readable
0–100 scores and assigns color-coded ratings (good / fair / poor).
Also calculates fluency and completeness scores.
"""


def map_probability_to_score(probability: float) -> int:
    """
    Map a faster-whisper word probability to a 0–100 pronunciation score.

    Whisper probabilities for well-pronounced English words are typically > 0.85.
    For mispronounced or unclear words they can drop to 0.1–0.5.
    The mapping is non-linear to spread the useful range.
    """
    p = max(0.0, min(1.0, probability))

    if p >= 0.95:
        score = 95 + int((p - 0.95) * 100)       # 95–100
    elif p >= 0.85:
        score = 80 + int((p - 0.85) * 150)        # 80–95
    elif p >= 0.70:
        score = 60 + int((p - 0.70) * 133)        # 60–80
    elif p >= 0.50:
        score = 40 + int((p - 0.50) * 100)        # 40–60
    elif p >= 0.30:
        score = 20 + int((p - 0.30) * 100)        # 20–40
    else:
        score = int(p * 66)                        # 0–20

    return max(0, min(100, score))


def assign_rating(score: int) -> str:
    """Assign a color-coded rating based on score."""
    if score >= 80:
        return "good"
    elif score >= 50:
        return "fair"
    else:
        return "poor"


def calculate_word_scores(words: list[dict]) -> list[dict]:
    """
    Take raw word data from faster-whisper and add score + rating.

    Input word dict: {word, start, end, probability}
    Output adds: {score, rating}
    """
    scored = []
    for w in words:
        score = map_probability_to_score(w["probability"])
        rating = assign_rating(score)
        scored.append({
            **w,
            "score": score,
            "rating": rating,
        })
    return scored


def calculate_fluency_score(words: list[dict]) -> int:
    """
    Estimate fluency from inter-word gaps.

    Natural English speech has gaps of ~0.1–0.4s between words.
    Long pauses or very uneven pacing indicate disfluency.
    """
    if len(words) < 2:
        return 50

    gaps = []
    long_pauses = 0

    for i in range(1, len(words)):
        gap = words[i]["start"] - words[i - 1]["end"]
        gaps.append(gap)
        if gap > 1.5:
            long_pauses += 1

    avg_gap = sum(gaps) / len(gaps)

    # Penalize for average gap length
    if avg_gap < 0.4:
        base = 92
    elif avg_gap < 0.6:
        base = 80
    elif avg_gap < 1.0:
        base = 65
    elif avg_gap < 1.5:
        base = 50
    else:
        base = 30

    # Penalize for many long pauses
    pause_penalty = min(long_pauses * 5, 25)

    return max(0, min(100, base - pause_penalty))


def calculate_completeness_score(words: list[dict]) -> int:
    """
    Completeness = ratio of well-pronounced words.
    """
    if not words:
        return 0

    good = sum(1 for w in words if w["rating"] == "good")
    return int((good / len(words)) * 100)


def calculate_overall_score(
    word_scores: list[dict],
    fluency: int,
    completeness: int,
) -> int:
    """
    Weighted overall score:
      60% average word confidence
      20% fluency
      20% completeness
    """
    if not word_scores:
        return 0

    avg_word = sum(w["score"] for w in word_scores) / len(word_scores)
    overall = int(avg_word * 0.60 + fluency * 0.20 + completeness * 0.20)
    return max(0, min(100, overall))
