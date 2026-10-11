import secrets
from datetime import datetime
from typing import Tuple, Optional

# Crockford Base32 Alphabet (excludes I, L, O, U)
CROCKFORD_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"
CROCKFORD_MAP = {c: i for i, c in enumerate(CROCKFORD_ALPHABET)}

# Canonical normalization map for human typing errors
NORMALIZATION_MAP = {
    'I': '1', 'i': '1',
    'L': '1', 'l': '1',
    'O': '0', 'o': '0'
}

def compute_check_char(chars: str) -> str:
    """Computes a Crockford Base32 check character using weighted modulo 32."""
    total = 0
    for idx, c in enumerate(chars):
        val = CROCKFORD_MAP.get(c, 0)
        weight = (idx % 7) + 1
        total += val * weight
    return CROCKFORD_ALPHABET[total % 32]

def generate_reference_number(prefix: str = "CS", date_obj: Optional[datetime] = None) -> str:
    """
    Generates a unique, non-sequential reference number in the format:
    CS-YYMMDD-XXXXXXXX (where the 8th character of the random block is a check digit).
    Example: CS-241011-7K3M9QX2
    """
    if date_obj is None:
        date_obj = datetime.utcnow()

    date_part = date_obj.strftime("%y%m%d")

    # Generate 7 random Crockford Base32 characters
    random_chars = "".join(secrets.choice(CROCKFORD_ALPHABET) for _ in range(7))

    # Compute 8th character as check digit over date_part + random_chars
    check_char = compute_check_char(date_part + random_chars)

    body = f"{random_chars}{check_char}"
    return f"{prefix}-{date_part}-{body}"

def normalize_reference_number(ref: str) -> str:
    """Normalizes a reference number by trimming, converting to uppercase, and replacing confusable letters."""
    if not ref:
        return ""
    cleaned = ref.strip().upper()
    result = []
    for c in cleaned:
        result.append(NORMALIZATION_MAP.get(c, c))
    return "".join(result)

def validate_reference_number(ref: str) -> Tuple[bool, Optional[str]]:
    """
    Validates the structure and checksum of a reference number.
    Returns (True, None) if valid, or (False, error_reason) if invalid.
    """
    normalized = normalize_reference_number(ref)
    parts = normalized.split("-")
    if len(parts) != 3:
        return False, "Reference number must follow the format CS-YYMMDD-XXXXXXXX"

    prefix, date_part, body = parts
    if prefix != "CS":
        return False, f"Invalid prefix '{prefix}'. Expected 'CS'"
    if len(date_part) != 6 or not date_part.isdigit():
        return False, "Invalid date format. Expected 6 digits (YYMMDD)"
    if len(body) != 8:
        return False, "Body must be exactly 8 characters"

    for c in body:
        if c not in CROCKFORD_MAP:
            return False, f"Invalid character '{c}' in reference number"

    random_7 = body[:7]
    given_check = body[7]
    expected_check = compute_check_char(date_part + random_7)

    if given_check != expected_check:
        return False, "Invalid reference number checksum"

    return True, None

def is_valid_reference_number(ref: str) -> bool:
    """Convenience boolean helper for reference number validation."""
    is_valid, _ = validate_reference_number(ref)
    return is_valid

