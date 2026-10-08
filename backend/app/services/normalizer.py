import re
from typing import Optional

SPOKEN_NUMBER_MAP = {
    "zero": "0", "one": "1", "two": "2", "three": "3", "four": "4",
    "five": "5", "six": "6", "seven": "7", "eight": "8", "nine": "9", "ten": "10",
    "பூஜ்யம்": "0", "ஒன்று": "1", "இரண்டு": "2", "மூன்று": "3", "நான்கு": "4",
    "ஐந்து": "5", "ஆறு": "6", "ஏழு": "7", "எட்டு": "8", "ஒன்பது": "9", "பத்து": "10"
}

KNOWN_EMAIL_DOMAINS = ["gmail", "yahoo", "outlook", "hotmail", "icloud"]

def normalize_transcript(text: str, data_type: Optional[str] = None) -> str:
    """
    Deterministic normalizer (Fix E) applied before LLM, validation, and grounding.
    1. Collapse runs of single letters/digits separated by spaces, commas, or hyphens into one token.
    2. Maps spoken symbols ('at', 'at the rate', 'dot', 'period', 'dash', 'underscore') to (@, ., -, _).
    3. Handles 'double X' and 'triple X' repetitions.
    4. Normalizes Emails: lowercases, removes spaces, appends standard TLD (.com) if domain is a known provider without TLD.
    5. Normalizes Names: collapses spaced letters, strips filler prefixes, and title-cases.
    """
    if not text or not text.strip():
        return ""

    cleaned = text.strip()

    # 1. Spoken symbols replacement
    cleaned = re.sub(r"(\bat the rate\b|\bat sign\b|\bat\b|அட்)", "@", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"(\bdot\b|\bperiod\b|புள்ளி)", ".", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"(\bunderscore\b|அண்டர்ஸ்கோர்)", "_", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"(\bdash\b|\bhyphen\b|டேஷ்)", "-", cleaned, flags=re.IGNORECASE)

    # 2. Spoken double/triple repetitions
    def replace_double(m):
        char = m.group(1)
        char_digit = SPOKEN_NUMBER_MAP.get(char.lower(), char)
        return char_digit * 2

    def replace_triple(m):
        char = m.group(1)
        char_digit = SPOKEN_NUMBER_MAP.get(char.lower(), char)
        return char_digit * 3

    cleaned = re.sub(r"\bdouble\s+([a-zA-Z0-9]+)\b", replace_double, cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"\btriple\s+([a-zA-Z0-9]+)\b", replace_triple, cleaned, flags=re.IGNORECASE)

    # 3. Collapse spaced single characters/digits (e.g. "S O U N D A R A R A J A N 9 1 6" -> "soundararajan916")
    spaced_char_pattern = r"(?:(?:\b[a-zA-Z0-9]\b)[\s,\-]*){2,}"

    def collapse_match(m):
        return re.sub(r"[\s,\-]", "", m.group(0))

    cleaned = re.sub(spaced_char_pattern, collapse_match, cleaned)

    # 4. Spoken number words to digits
    for word, digit in SPOKEN_NUMBER_MAP.items():
        cleaned = re.sub(r"\b" + word + r"\b", digit, cleaned, flags=re.IGNORECASE)

    # 5. Email specific normalization
    if "@" in cleaned or any(d in cleaned.lower() for d in KNOWN_EMAIL_DOMAINS):
        cleaned = re.sub(r"\s*@\s*", "@", cleaned)
        cleaned = re.sub(r"\s*\.\s*", ".", cleaned)
        cleaned = cleaned.lower().strip()

        # Remove filler words from email
        cleaned = re.sub(r"^my\s+email\s+is\s+", "", cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(r"^email\s+is\s+", "", cleaned, flags=re.IGNORECASE)

        # Fix missing TLD on known providers (e.g. "soundararajan916@gmail" -> "soundararajan916@gmail.com")
        email_match = re.match(r"^([^@\s]+)@([a-z0-9]+)$", cleaned)
        if email_match:
            user_part, domain_part = email_match.groups()
            if domain_part in KNOWN_EMAIL_DOMAINS:
                cleaned = f"{user_part}@{domain_part}.com"

    # 6. Name specific normalization
    elif data_type == "String":
        for prefix in [r"^my name is\s+", r"^i am\s+", r"^name is\s+", r"^this is\s+", r"^i'm\s+"]:
            cleaned = re.sub(prefix, "", cleaned, flags=re.IGNORECASE)
        cleaned = cleaned.rstrip(".!?,")
        cleaned = cleaned.title()

    return cleaned.strip()
