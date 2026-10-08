import re
from datetime import datetime
from typing import Tuple, Optional, List

# Spoken digit mappings for Tamil & English
TAMIL_DIGIT_MAP = {
    "பூஜ்யம்": "0", "ஒன்று": "1", "இரண்டு": "2", "மூன்று": "3", "நான்கு": "4",
    "ஐந்து": "5", "ஆறு": "6", "ஏழு": "7", "எட்டு": "8", "ஒன்பது": "9", "பத்து": "10"
}
ENGLISH_DIGIT_MAP = {
    "zero": "0", "one": "1", "two": "2", "three": "3", "four": "4",
    "five": "5", "six": "6", "seven": "7", "eight": "8", "nine": "9", "ten": "10"
}

def normalize_spoken_digits(text: str) -> str:
    cleaned = text.lower()
    for word, digit in TAMIL_DIGIT_MAP.items():
        cleaned = cleaned.replace(word, digit)
    for word, digit in ENGLISH_DIGIT_MAP.items():
        cleaned = cleaned.replace(word, digit)
    return cleaned

def fast_path_validate(
    transcript: str,
    data_type: str,
    choices: Optional[List[str]] = None
) -> Tuple[bool, Optional[str]]:
    """
    Checks if transcript matches true fast path (no LLM required).
    NOTE: String fields NEVER take the fast path!
    """
    if data_type == "String":
        return False, None

    clean_text = transcript.strip().lower()

    if data_type in ["Number", "Phone"]:
        normalized = normalize_spoken_digits(clean_text)
        digits_only = re.sub(r"[^\d+]", "", normalized)
        if data_type == "Phone" and (len(digits_only) == 10 or (len(digits_only) == 13 and digits_only.startswith("+91"))):
            return True, digits_only
        elif data_type == "Number" and digits_only.isdigit():
            return True, digits_only

    elif data_type == "Boolean":
        if clean_text in ["yes", "yeah", "yup", "true", "1", "ஆமாம்", "சரி", "ஆம்"]:
            return True, "Yes"
        elif clean_text in ["no", "nope", "false", "0", "இல்லை", "தவறு"]:
            return True, "No"

    elif data_type == "Choice" and choices:
        for opt in choices:
            if clean_text == opt.strip().lower():
                return True, opt.strip()

    return False, None

def validate_rule(
    value: str,
    data_type: str,
    choices: Optional[List[str]] = None
) -> Tuple[bool, str, Optional[str]]:
    """
    Rule-based validation of value post-LLM extraction.
    Returns (is_valid, cleaned_value, error_message).
    """
    if not value or not str(value).strip():
        return False, "", "Value is required."

    val_str = str(value).strip()

    if data_type == "Email":
        email_clean = val_str.lower().replace(" at the rate ", "@").replace(" at ", "@").replace(" dot ", ".").replace(" ", "")
        email_pattern = r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$"
        if re.match(email_pattern, email_clean):
            return True, email_clean, None
        return False, val_str, "Invalid email address format."

    elif data_type == "Phone":
        normalized = normalize_spoken_digits(val_str)
        digits_only = re.sub(r"[^\d+]", "", normalized)
        if len(digits_only) == 10:
            return True, digits_only, None
        elif len(digits_only) == 13 and digits_only.startswith("+91"):
            return True, digits_only, None
        return False, val_str, "Phone number must contain 10 digits."

    elif data_type == "Number":
        normalized = normalize_spoken_digits(val_str)
        try:
            if "." in normalized:
                num = float(normalized)
                return True, str(num), None
            else:
                num = int(re.sub(r"[^\d-]", "", normalized))
                return True, str(num), None
        except ValueError:
            return False, val_str, "Please enter a valid number."

    elif data_type == "Date":
        date_formats = ["%Y-%m-%d", "%d-%m-%Y", "%d/%m/%Y", "%Y/%m/%d"]
        for fmt in date_formats:
            try:
                dt = datetime.strptime(val_str, fmt)
                return True, dt.strftime("%Y-%m-%d"), None
            except ValueError:
                pass
        return False, val_str, "Date must be in YYYY-MM-DD format."

    elif data_type == "Boolean":
        val_lower = val_str.lower()
        if val_lower in ["yes", "true", "1", "ஆமாம்", "சரி", "ஆம்"]:
            return True, "Yes", None
        elif val_lower in ["no", "false", "0", "இல்லை", "தவறு"]:
            return True, "No", None
        return False, val_str, "Please answer with Yes or No."

    elif data_type == "Choice" and choices:
        val_lower = val_str.lower()
        for opt in choices:
            if val_lower == opt.lower() or val_lower in opt.lower() or opt.lower() in val_lower:
                return True, opt.strip(), None
        return False, val_str, f"Must be one of: {', '.join(choices)}"

    # Default String validation
    return True, val_str, None
