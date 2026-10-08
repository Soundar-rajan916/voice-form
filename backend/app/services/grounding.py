import re
from typing import Tuple
from difflib import SequenceMatcher

SPOKEN_NUMBER_WORDS = [
    "zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
    "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen",
    "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety", "hundred",
    "பூஜ்யம்", "ஒன்று", "இரண்டு", "மூன்று", "நான்கு", "ஐந்து", "ஆறு", "ஏழு", "எட்டு", "ஒன்பது", "பத்து"
]

VAGUE_NUMBER_RESPONSES = ["teen", "young", "old", "adult", "student", "kid", "child", "don't know", "dont know", "not sure"]

def verify_grounding(extracted_val: str, raw_transcript: str, data_type: str) -> Tuple[bool, str]:
    """
    Grounding check (Fix D): Verifies that extracted value is explicitly traceable to transcript tokens.
    Returns (is_grounded, failure_reason).
    """
    if not extracted_val or not str(extracted_val).strip():
        return False, "Extracted value is empty"

    val_str = str(extracted_val).strip().lower()
    trans_lower = raw_transcript.strip().lower()

    if data_type in ["Number", "Phone"]:
        if any(vague in trans_lower for vague in VAGUE_NUMBER_RESPONSES) and not any(c.isdigit() for c in trans_lower):
            return False, f"Vague response '{trans_lower}' is not an exact numeric value"

        val_digits = re.sub(r"[^\d]", "", val_str)
        trans_digits = re.sub(r"[^\d]", "", trans_lower)

        if val_digits and val_digits in trans_digits:
            return True, "Grounded in transcript digits"

        for word in SPOKEN_NUMBER_WORDS:
            if word in trans_lower:
                return True, "Grounded in spoken number words"

        return False, f"Extracted value '{val_str}' cannot be traced to digits or number words in '{raw_transcript}'"

    elif data_type == "Email":
        if "@" not in val_str:
            return False, "Invalid email format"
        user_part, domain_part = val_str.split("@", 1)

        trans_clean = re.sub(r"[^\w]", "", trans_lower)
        user_clean = re.sub(r"[^\w]", "", user_part)
        domain_base = domain_part.split(".")[0]

        user_match = (user_clean in trans_clean) or (SequenceMatcher(None, user_clean, trans_clean).ratio() > 0.6)
        domain_match = (domain_base in trans_clean) or (SequenceMatcher(None, domain_base, trans_clean).ratio() > 0.6)

        if user_match and domain_match:
            return True, "Grounded email user and domain"
        return False, f"Email '{val_str}' user/domain not traceable in '{raw_transcript}'"

    elif data_type == "String":
        val_tokens = re.findall(r"\w+", val_str)
        trans_tokens = re.findall(r"\w+", trans_lower)

        if not val_tokens:
            return False, "Empty tokens"

        matches = 0
        for vt in val_tokens:
            if any(vt in tt or SequenceMatcher(None, vt, tt).ratio() > 0.7 for tt in trans_tokens):
                matches += 1

        if matches / len(val_tokens) >= 0.5:
            return True, "Grounded name tokens"
        return False, f"Extracted name '{val_str}' not traceable in transcript '{raw_transcript}'"

    return True, "Default grounded"
