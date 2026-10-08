import re
from typing import List, Optional, Tuple
from app.models import FormField

EXCLUDED_DOMAIN_TOKENS = {
    "gmail", "yahoo", "outlook", "hotmail", "com", "in", "org", "net", "at", "dot",
    "http", "https", "www"
}

POLITENESS_WRAPPERS = [
    r"\bcan\s+you\b", r"\bcould\s+you\b", r"\bplease\b", r"\bi\s+want\s+to\b",
    r"\blet\s+me\b", r"\bwould\s+you\b", r"தயவுசெய்து", r"முடியுமா"
]

def parse_navigation_command(
    transcript: str,
    fields: List[FormField],
    active_field: Optional[FormField] = None
) -> Tuple[Optional[str], Optional[int], Optional[List[FormField]], Optional[str]]:
    """
    Robust Command Detection (Fix 3): Recognizes command phrase families across English and Tamil,
    handling politeness wrappers, 'X is wrong' patterns, field aliases, and fallback to previous field.
    Returns (intent, target_field_id, ambiguous_candidates, message).
    """
    if not transcript or not transcript.strip():
        return None, None, None, None

    text = transcript.strip().lower()
    text_clean = text.translate(str.maketrans('', '', '.,!?:;""\'`()-'))

    # Strip politeness wrappers for pattern matching
    stripped_text = text_clean
    for p in POLITENESS_WRAPPERS:
        stripped_text = re.sub(p, "", stripped_text, flags=re.IGNORECASE).strip()

    # 1. UNDO COMMANDS
    undo_patterns = [
        r"\bundo\b", r"\bundo\s+last\b", r"\bcancel\s+last\b",
        r"தவறு", r"ரத்துசெய்"
    ]
    for p in undo_patterns:
        if re.search(p, stripped_text):
            return "undo", None, None, None

    # 2. SKIP & REPEAT COMMANDS
    if re.search(r"\bskip\b|தவிர்", stripped_text):
        return "skip", None, None, None
    if re.search(r"\brepeat\b|\bsay\s+again\b|மீண்டும்", stripped_text):
        return "repeat", None, None, None

    # 3. BACK & PREVIOUS COMMANDS
    back_patterns = [
        r"\bgo\s+back\b", r"\bprevious\s+question\b", r"\bprevious\b", r"\bback\b",
        r"\btake\s+me\s+back\b", r"\bmove\s+back\b",
        r"பின்னால்", r"பின்னாடி", r"முந்தைய\s+கேள்வி", r"முந்தைய", r"முன்னாடி\s+செல்"
    ]
    is_back_command = any(re.search(p, stripped_text) for p in back_patterns)

    # 4. "X IS WRONG" / "MADE A MISTAKE IN X" PATTERNS
    wrong_patterns = [
        r"\bis\s+wrong\b", r"\bwas\s+wrong\b", r"\bis\s+incorrect\b", r"\bwrong\b",
        r"\bmade\s+a\s+mistake\b", r"\bthats\s+wrong\b", r"\bthat's\s+wrong\b",
        r"\bthat\s+is\s+wrong\b", r"\bthats\s+not\s+right\b", r"பிழை", r"தவறான", r"பிழையான"
    ]
    is_wrong_command = any(re.search(p, stripped_text) for p in wrong_patterns)

    # 5. CHANGE / EDIT / REDO / CORRECT / FIX PATTERNS
    change_patterns = [
        r"\bchange\b", r"\bredo\b", r"\bedit\b", r"\bfix\b", r"\bcorrect\b", r"\bupdate\b",
        r"\bgo\s+to\b", r"\bgoto\b", r"மாற்று", r"திருத்து"
    ]
    is_change_command = any(re.search(p, stripped_text) for p in change_patterns)

    # If none of the command families match, this is NOT a command
    if not (is_back_command or is_wrong_command or is_change_command):
        return None, None, None, None

    # Match target fields
    matched_fields = _match_target_fields(stripped_text, fields)

    # Case A: Exact single field matched
    if len(matched_fields) == 1:
        return "goto", matched_fields[0].id, None, None

    # Case B: Ambiguous multiple fields matched
    elif len(matched_fields) > 1:
        field_names = [f.field_name.replace("_", " ") for f in matched_fields]
        names_str = " or ".join(field_names)
        msg = f"Which field would you like to change? {names_str}?"
        return "ambiguous", None, matched_fields, msg

    # Case C: Command with NO target field specified (e.g. "go back", "that's wrong", "I made a mistake")
    else:
        # Default to previous field in position sequence
        if active_field and fields:
            active_idx = next((i for i, f in enumerate(fields) if f.id == active_field.id), 0)
            if active_idx > 0:
                prev_field = fields[active_idx - 1]
                return "goto", prev_field.id, None, None
            else:
                return "back", None, None, None
        return "back", None, None, None

def _match_target_fields(text: str, fields: List[FormField]) -> List[FormField]:
    matched = []
    raw_tokens = set(text.lower().split())
    tokens = {t.strip('.,!?:;""\'`()-') for t in raw_tokens} - EXCLUDED_DOMAIN_TOKENS

    if not tokens:
        return matched

    synonym_map = {
        "email": ["email", "e-mail", "mail", "மின்னஞ்சல்"],
        "phone": ["phone", "mobile", "contact", "number", "தொலைபேசி", "கைபேசி"],
        "name": ["name", "full name", "first name", "last name", "பெயர்"]
    }

    for field in fields:
        fname = field.field_name.lower().replace("_", " ")
        ftype = field.data_type.lower()
        fdesc = (field.description or "").lower()

        # Token match on formatted field_name (e.g. "full name" -> "full_name")
        fname_tokens = set(re.findall(r"\w+", fname))
        if fname_tokens and fname_tokens.issubset(tokens):
            if field not in matched:
                matched.append(field)
            continue

        # Email synonyms
        if ftype == "email" or "email" in fname:
            if any(syn in tokens or syn in text for syn in synonym_map["email"]):
                if field not in matched:
                    matched.append(field)
                continue

        # Phone synonyms
        if ftype == "phone" or "phone" in fname or "mobile" in fname:
            if any(syn in tokens or syn in text for syn in synonym_map["phone"]):
                if field not in matched:
                    matched.append(field)
                continue

        # Name synonyms
        if "name" in fname or "name" in fdesc:
            if any(syn in tokens or syn in text for syn in synonym_map["name"]):
                if field not in matched:
                    matched.append(field)
                continue

    return matched
