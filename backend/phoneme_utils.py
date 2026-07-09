import pronouncing

# Common phoneme confusions for English learners (mapped by ARPAbet base phoneme)
COMMON_CONFUSIONS = {
    "TH": {
        "confused_with": "T or D",
        "tip": "Place your tongue between your teeth and blow air gently for the 'th' sound.",
        "ipa": "θ/ð",
    },
    "DH": {
        "confused_with": "D or Z",
        "tip": "Place your tongue between your teeth and vibrate your vocal cords for the voiced 'th'.",
        "ipa": "ð",
    },
    "R": {
        "confused_with": "L or W",
        "tip": "Curl your tongue back slightly without touching the roof of your mouth.",
        "ipa": "ɹ",
    },
    "L": {
        "confused_with": "R or N",
        "tip": "Touch the tip of your tongue to the ridge behind your upper teeth.",
        "ipa": "l",
    },
    "V": {
        "confused_with": "W or B",
        "tip": "Bite your lower lip gently and push air through for the 'v' sound.",
        "ipa": "v",
    },
    "W": {
        "confused_with": "V",
        "tip": "Round your lips into a small 'O' shape and release them as you voice the sound.",
        "ipa": "w",
    },
    "Z": {
        "confused_with": "S or J",
        "tip": "Make the 'S' sound but add vibration from your vocal cords.",
        "ipa": "z",
    },
    "ZH": {
        "confused_with": "SH or J",
        "tip": "Shape your mouth like 'SH' but add vocal cord vibration, as in 'measure'.",
        "ipa": "ʒ",
    },
    "SH": {
        "confused_with": "S or CH",
        "tip": "Round your lips and push air through with your tongue wide, as in 'ship'.",
        "ipa": "ʃ",
    },
    "CH": {
        "confused_with": "SH or T",
        "tip": "Start with your tongue touching the roof, then release into a 'SH' sound.",
        "ipa": "tʃ",
    },
    "JH": {
        "confused_with": "CH or Z",
        "tip": "Like 'CH' but with vocal cord vibration, as in 'judge'.",
        "ipa": "dʒ",
    },
    "AE": {
        "confused_with": "EH or AH",
        "tip": "Open your mouth wide and spread your lips, as in 'cat'. It's between 'ah' and 'eh'.",
        "ipa": "æ",
    },
    "IH": {
        "confused_with": "EE or EH",
        "tip": "Relax your tongue slightly lower than 'ee', as in 'sit' (not 'seat').",
        "ipa": "ɪ",
    },
    "UH": {
        "confused_with": "OO or AH",
        "tip": "Relax your tongue in the center of your mouth, as in 'book' (not 'boot').",
        "ipa": "ʊ",
    },
    "ER": {
        "confused_with": "AH or UH",
        "tip": "Curl your tongue back while keeping your mouth partially open, as in 'bird'.",
        "ipa": "ɝ",
    },
    "AO": {
        "confused_with": "AA or OW",
        "tip": "Round your lips and open your mouth moderately, as in 'thought'.",
        "ipa": "ɔ",
    },
    "OW": {
        "confused_with": "AO or UH",
        "tip": "Start with an open mouth and glide to a rounded lip position, as in 'go'.",
        "ipa": "oʊ",
    },
    "AY": {
        "confused_with": "AA or EY",
        "tip": "Start with mouth wide open and glide upward, as in 'buy'.",
        "ipa": "aɪ",
    },
}

# Set of phonemes that are frequently difficult for non-native speakers
DIFFICULT_PHONEMES = {
    "TH", "DH", "R", "L", "V", "W", "Z", "ZH",
    "AE", "IH", "UH", "ER", "AO", "OW",
}


def get_phoneme_analysis(word: str) -> dict:
    """Look up phonemes for a word in CMU Dict and identify potential issues."""
    word_clean = word.lower().strip(".,!?;:\"'()-[]{}…")

    if not word_clean or len(word_clean) < 2:
        return {
            "word": word_clean,
            "arpabet": None,
            "syllable_count": None,
            "common_issues": [],
            "tips": [],
        }

    phones_list = pronouncing.phones_for_word(word_clean)

    if not phones_list:
        return {
            "word": word_clean,
            "arpabet": None,
            "syllable_count": None,
            "common_issues": [],
            "tips": [],
        }

    # Use the first (most common) pronunciation variant
    arpabet = phones_list[0]
    phoneme_list = arpabet.split()

    syllable_count = pronouncing.syllable_count(arpabet)

    common_issues = []
    tips = []
    seen_phonemes = set()

    for phoneme in phoneme_list:
        # Strip stress markers (0, 1, 2) for base comparison
        base_phoneme = phoneme.rstrip("012")

        if base_phoneme in COMMON_CONFUSIONS and base_phoneme not in seen_phonemes:
            seen_phonemes.add(base_phoneme)
            confusion = COMMON_CONFUSIONS[base_phoneme]
            common_issues.append(
                f"/{confusion['ipa']}/ (written '{base_phoneme}') is often confused with {confusion['confused_with']}"
            )
            tips.append(confusion["tip"])

    return {
        "word": word_clean,
        "arpabet": arpabet,
        "syllable_count": syllable_count,
        "common_issues": common_issues[:3],
        "tips": tips[:3],
    }


def get_difficult_phoneme_summary(words_with_phonemes: list) -> list:
    """Summarize which difficult phonemes appear across flagged words."""
    phoneme_counts = {}

    for w in words_with_phonemes:
        if w.get("rating") in ("fair", "poor") and w.get("phonemes", {}).get("arpabet"):
            for phoneme in w["phonemes"]["arpabet"].split():
                base = phoneme.rstrip("012")
                if base in DIFFICULT_PHONEMES:
                    phoneme_counts[base] = phoneme_counts.get(base, 0) + 1

    # Sort by frequency
    sorted_phonemes = sorted(phoneme_counts.items(), key=lambda x: -x[1])

    return [
        {
            "phoneme": p,
            "count": c,
            "info": COMMON_CONFUSIONS.get(p, {}),
        }
        for p, c in sorted_phonemes[:5]
    ]
