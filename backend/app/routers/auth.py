from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional
from app.db import get_db
from app.models import User
from app.schemas import UserRegister, UserLogin, UserResponse, Token
from app.security import hash_password, verify_password, create_access_token, check_login_rate_limit
from app.deps import get_current_user

router = APIRouter(prefix="/auth", tags=["auth"])

@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register(user_in: UserRegister, db: AsyncSession = Depends(get_db)):
    # Check if email exists
    result = await db.execute(select(User).where(User.email == user_in.email.lower().strip()))
    existing_user = result.scalar_one_or_none()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email is already registered"
        )

    # CRITICAL: Always hardcode role to 'user'. Registration CANNOT create an admin.
    new_user = User(
        email=user_in.email.lower().strip(),
        username=user_in.username.strip() if user_in.username else None,
        hashed_password=hash_password(user_in.password),
        role="user"
    )
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)
    return new_user

@router.post("/login", response_model=Token)
async def login(
    request: Request,
    user_in: Optional[UserLogin] = None,
    db: AsyncSession = Depends(get_db)
):
    email = None
    password = None

    if user_in and user_in.email:
        email = user_in.email.lower().strip()
        password = user_in.password
    else:
        # Fallback to form data or json body from request if not parsed automatically
        try:
            body = await request.json()
            email = body.get("email") or body.get("username")
            password = body.get("password")
            if email:
                email = str(email).lower().strip()
        except Exception:
            pass

    if not email or not password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email and password required"
        )

    client_ip = request.client.host if request.client else "unknown"
    rate_limit_key = f"{client_ip}:{email}"

    if not check_login_rate_limit(rate_limit_key, max_attempts=5, window_seconds=60):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many login attempts. Please try again in a minute."
        )

    result = await db.execute(
        select(User).where(
            (User.email == email) | (User.username == email)
        )
    )
    user = result.scalar_one_or_none()

    if not user or not verify_password(password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token = create_access_token(data={"sub": str(user.id), "role": user.role})
    return Token(
        access_token=access_token,
        token_type="bearer",
        user=UserResponse.model_validate(user)
    )

@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user
