import base64
import hashlib
import re
from typing import Optional
from cryptography.fernet import Fernet
from app.config import settings

_fernet_instance: Optional[Fernet] = None
_warned_default_key: bool = False

def get_fernet() -> Fernet:
    global _fernet_instance, _warned_default_key
    if _fernet_instance is not None:
        return _fernet_instance

    key = settings.FERNET_KEY.strip() if settings.FERNET_KEY else ""
    if not key:
        if not _warned_default_key:
            print("[SECURITY WARNING] No FERNET_KEY configured. Deriving fallback encryption key from JWT_SECRET.")
            _warned_default_key = True
        # Derive 32-byte base64-encoded key from JWT_SECRET
        raw_digest = hashlib.sha256(settings.JWT_SECRET.encode("utf-8")).digest()
        key = base64.urlsafe_b64encode(raw_digest).decode("utf-8")
    else:
        # If raw 32 bytes or string not yet 32-byte urlsafe base64, normalize it
        try:
            Fernet(key.encode("utf-8"))
        except Exception:
            raw_digest = hashlib.sha256(key.encode("utf-8")).digest()
            key = base64.urlsafe_b64encode(raw_digest).decode("utf-8")

    _fernet_instance = Fernet(key.encode("utf-8"))
    return _fernet_instance

def encrypt_sensitive_value(plain_text: str) -> str:
    """Encrypts a sensitive string value using Fernet."""
    if not plain_text:
        return plain_text
    f = get_fernet()
    encrypted_bytes = f.encrypt(plain_text.encode("utf-8"))
    return "enc:" + encrypted_bytes.decode("utf-8")

def decrypt_sensitive_value(stored_value: str) -> str:
    """Decrypts a stored value if encrypted, or returns it directly."""
    if not stored_value:
        return stored_value
    if not stored_value.startswith("enc:"):
        return stored_value
    f = get_fernet()
    raw_token = stored_value[4:].encode("utf-8")
    try:
        decrypted_bytes = f.decrypt(raw_token)
        return decrypted_bytes.decode("utf-8")
    except Exception as e:
        print(f"[Crypto Error] Decryption failed: {e}")
        return "••••"

def mask_sensitive_value(plain_text: str) -> str:
    """
    Masks a sensitive value so only the last 4 characters are visible.
    Example: '123456789012' -> '•••• •••• 9012'
    """
    if not plain_text:
        return ""
    # Strip spaces/dashes for clean counting
    clean_digits = re.sub(r'[\s\-]', '', plain_text)
    if len(clean_digits) > 4:
        masked_prefix = "•" * (len(clean_digits) - 4)
        last_four = clean_digits[-4:]
        # Group in blocks of 4 if reasonably long
        if len(masked_prefix) >= 8:
            return f"•••• •••• {last_four}"
    return "••••"

# Aliases
encrypt_field_value = encrypt_sensitive_value
decrypt_field_value = decrypt_sensitive_value
mask_field_value = mask_sensitive_value

SENSITIVE_TERMS = [
    "aadhaar", "aadhar", "pan", "voter", "epic", "ration", "bank_account",
    "account_number", "passport", "driving_license", "ssn", "identity_number"
]

def check_auto_sensitive_field(field_name: str, description: str = "") -> bool:
    """Auto-detects whether a field name or description refers to a sensitive number."""
    combined = f"{field_name} {description}".lower()
    return any(term in combined for term in SENSITIVE_TERMS)
