import re
from typing import List, Tuple, Optional
from difflib import SequenceMatcher

HALLUCINATION_PHRASES = [
    "indian speaker", "thank you", "thanks for watching", "i'm sorry", "im sorry",
    "subtitles by", "amara.org", "like and subscribe", "listening to",
    "நன்றி", "மன்னிக்கவும்", "இந்திய பேச்சாளர்"
]

VALID_SHORT_ANSWERS = {"yes", "no", "true", "false", "ok", "yeah", "nope", "yep", "ஆம்", "இல்லை", "சரி"}

def check_echo_guard(
    transcript: str,
    recent_bot_messages: List[str],
    threshold: float = 0.8
) -> Tuple[bool, float, Optional[str]]:
    """
    Echo Guard (Fix A): Normalizes transcript and compares with recent bot messages using token fuzzy similarity.
    Returns (is_echo, max_similarity, matched_bot_msg).
    """
    if not transcript or not transcript.strip() or not recent_bot_messages:
        return False, 0.0, None

    trans_clean = re.sub(r"[^\w\s]", "", transcript.lower()).strip()
    if not trans_clean:
        return False, 0.0, None

    max_sim = 0.0
    matched_msg = None

    for bot_msg in recent_bot_messages:
        bot_clean = re.sub(r"[^\w\s]", "", bot_msg.lower()).strip()
        if not bot_clean:
            continue

        if trans_clean in bot_clean or bot_clean in trans_clean:
            sim = 0.95
        else:
            sim = SequenceMatcher(None, trans_clean, bot_clean).ratio()

        if sim > max_sim:
            max_sim = sim
            matched_msg = bot_msg

    if max_sim >= threshold:
        return True, max_sim, matched_msg

    return False, max_sim, None

def check_hallucination_filter(transcript: str) -> Tuple[bool, Optional[str]]:
    """
    Hallucination Filter (Fix B): Drops stock Whisper hallucinations while preserving real short answers.
    Returns (is_hallucination, reason).
    """
    if not transcript or not transcript.strip():
        return True, "Empty transcript"

    trans_lower = transcript.strip().lower()
    trans_clean = re.sub(r"[^\w\s]", "", trans_lower)

    if trans_clean in VALID_SHORT_ANSWERS or trans_clean.isdigit():
        return False, "Valid short answer"

    for phrase in HALLUCINATION_PHRASES:
        if phrase in trans_lower:
            words = trans_clean.split()
            if len(words) <= 5 or trans_clean == phrase:
                return True, f"Matched stock hallucination phrase '{phrase}'"

    return False, "Clean transcript"
