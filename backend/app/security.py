import bcrypt
import jwt
import time
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Tuple
from app.config import settings

def hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))
    except Exception:
        return False

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=settings.JWT_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.JWT_SECRET, algorithm="HS256")
    return encoded_jwt

def decode_access_token(token: str) -> Optional[dict]:
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=["HS256"])
        return payload
    except jwt.PyJWTError:
        return None

# Simple In-Memory Rate Limiter for Login
_login_attempts: Dict[str, list] = {} # key: ip/email -> list of timestamps

def check_login_rate_limit(key: str, max_attempts: int = 5, window_seconds: int = 60) -> bool:
    """Returns True if allowed, False if rate limited."""
    now = time.time()
    attempts = _login_attempts.get(key, [])
    # Filter attempts within window
    valid_attempts = [t for t in attempts if now - t < window_seconds]
    if len(valid_attempts) >= max_attempts:
        _login_attempts[key] = valid_attempts
        return False
    valid_attempts.append(now)
    _login_attempts[key] = valid_attempts
    return True
