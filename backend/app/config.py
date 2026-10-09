import os
from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    DATABASE_URL: str = "sqlite+aiosqlite:///./voiceform.db"
    JWT_SECRET: str = "supersecretkey_change_in_production_voiceform_123"
    JWT_EXPIRE_MINUTES: int = 1440
    ADMIN_EMAIL: str = "admin@voiceform.com"
    ADMIN_PASSWORD: str = "Admin@12345"

    # STT Provider Settings ("groq" or "sarvam")
    STT_PROVIDER: str = "groq"
    GROQ_API_KEY: str = ""
    GROQ_STT_MODEL: str = "whisper-large-v3-turbo"
    GROQ_STT_VOCAB_PROMPT: str = "" # Off by default, optional short vocabulary list only
    GROQ_LLM_MODEL: str = "qwen/qwen3.8-27b"

    SARVAM_API_KEY: str = ""
    SARVAM_STT_MODEL: str = "saarika:v2"

    # Document Upload & Security Limits
    MAX_UPLOAD_MB: int = 10
    MAX_PDF_PAGES: int = 30
    DOC_EXTRACT_TIMEOUT_S: int = 30
    UPLOADS_PER_HOUR: int = 10
    CLAMAV_HOST: str = ""

    # Document LLM & Vision AI Settings
    GROQ_DOC_MODEL: str = "qwen/qwen3.8-27b"
    VISION_MODEL: str = "qwen/qwen3.8-27b"
    VISION_DPI: int = 150
    VISION_MAX_PAGES: int = 8
    VISION_MAX_IMAGES_PER_REQUEST: int = 4
    VISION_DOUBLE_CHECK: bool = False

    CORS_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000"
    ]

    # VAD Silence Waits (ms)
    SILENCE_STRING_MS: int = 600
    SILENCE_NUMBER_MS: int = 600
    SILENCE_BOOLEAN_MS: int = 600
    SILENCE_CHOICE_MS: int = 600
    SILENCE_EMAIL_MS: int = 1200
    SILENCE_PHONE_MS: int = 1200
    SILENCE_DATE_MS: int = 1200

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()
