from typing import Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.db import get_db
from app.models import User, Submission
from app.security import decode_access_token

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")
oauth2_scheme_optional = OAuth2PasswordBearer(tokenUrl="/auth/login", auto_error=False)

async def get_current_user_optional(
    token: Optional[str] = Depends(oauth2_scheme_optional),
    db: AsyncSession = Depends(get_db)
) -> Optional[User]:
    if not token:
        return None
    payload = decode_access_token(token)
    if not payload:
        return None
    user_id = payload.get("sub")
    if not user_id:
        return None
    try:
        user_id_int = int(user_id)
    except ValueError:
        return None
    result = await db.execute(select(User).where(User.id == user_id_int))
    user = result.scalar_one_or_none()
    if user and getattr(user, 'is_active', True):
        setattr(user, 'token_payload', payload)
        return user
    return None

async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db)
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    payload = decode_access_token(token)
    if payload is None:
        raise credentials_exception

    user_id = payload.get("sub")
    if user_id is None:
        raise credentials_exception

    try:
        user_id_int = int(user_id)
    except ValueError:
        raise credentials_exception

    result = await db.execute(select(User).where(User.id == user_id_int))
    user = result.scalar_one_or_none()
    if user is None:
        raise credentials_exception

    if not getattr(user, 'is_active', True):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is revoked or inactive"
        )

    # Attach decoded token payload for scoped token checks
    setattr(user, 'token_payload', payload)
    return user

async def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin privileges required"
        )
    return current_user

async def require_operator(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role not in ("operator", "admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Operator privileges required"
        )
    return current_user

async def require_staff(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role not in ("operator", "admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Staff privileges required"
        )
    return current_user

async def require_kiosk(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role not in ("kiosk", "admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Kiosk privileges required"
        )
    return current_user

async def require_user(current_user: User = Depends(get_current_user)) -> User:
    if not current_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required"
        )
    return current_user

def check_submission_access(submission: Submission, current_user: User) -> None:
    """
    Enforces object-level access control on submissions:
    - Kiosk scoped tokens can ONLY access their specific active session submission.
    - Operators can ONLY access applications they personally assisted.
    - Users can ONLY access applications they own.
    - Admins have global access.
    """
    payload = getattr(current_user, 'token_payload', {}) or {}
    scope = payload.get("scope")

    if scope == "kiosk_session":
        scoped_sub_id = payload.get("submission_id")
        if scoped_sub_id != submission.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Kiosk session token is restricted to its own application"
            )
        return

    if current_user.role == "admin":
        return

    if current_user.role == "operator":
        if submission.assisted_by != current_user.id and submission.user_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Operators can only view their own assisted applications"
            )
        return

    # Regular user / citizen
    if submission.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Submission not found"
        )
