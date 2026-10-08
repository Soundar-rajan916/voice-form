import time
import httpx
from typing import Optional, Tuple
from app.config import settings
from app.services.questions import get_httpx_client

GROQ_STT_URL = "https://api.groq.com/openai/v1/audio/transcriptions"

async def transcribe_audio_wav(
    audio_bytes: bytes,
    language_hint: Optional[str] = None,
    field_description: Optional[str] = None
) -> Tuple[str, str, float]:
    """
    Transcribes binary WAV audio using Groq Whisper API.
    Enforces Fix 1: No descriptive context prompts, metadata probability filtering.
    Returns (transcript_text, detected_language, stt_duration_seconds).
    """
    start_time = time.time()

    if not settings.GROQ_API_KEY or settings.GROQ_API_KEY.startswith("gsk_dummy"):
        stt_duration = round(time.time() - start_time, 4)
        return "Simulated audio transcript", language_hint or "en", stt_duration

    client = get_httpx_client()

    files = {
        "file": ("audio.wav", audio_bytes, "audio/wav")
    }
    data = {
        "model": settings.GROQ_STT_MODEL,
        "response_format": "verbose_json"
    }

    # Pass language parameter if specified (omit only for auto)
    if language_hint and language_hint in ["en", "ta"]:
        data["language"] = language_hint

    # Vocab prompt (optional short vocabulary list only, off by default)
    if settings.GROQ_STT_VOCAB_PROMPT and settings.GROQ_STT_VOCAB_PROMPT.strip():
        data["prompt"] = settings.GROQ_STT_VOCAB_PROMPT.strip()

    headers = {
        "Authorization": f"Bearer {settings.GROQ_API_KEY}"
    }

    try:
        res = await client.post(GROQ_STT_URL, headers=headers, data=data, files=files)
        stt_duration = round(time.time() - start_time, 4)

        if res.status_code == 200:
            result_json = res.json()
            text = result_json.get("text", "").strip()
            detected_lang = result_json.get("language", language_hint or "en")

            # Verbose segment metadata filtering (Fix 1)
            segments = result_json.get("segments", [])
            for seg in segments:
                no_speech_prob = seg.get("no_speech_prob", 0.0)
                avg_logprob = seg.get("avg_logprob", 0.0)
                compression_ratio = seg.get("compression_ratio", 1.0)

                if no_speech_prob > 0.6 or avg_logprob < -1.0 or compression_ratio > 2.4:
                    print(f"[STT Metadata Drop] High no_speech_prob ({no_speech_prob:.2f}) or low avg_logprob ({avg_logprob:.2f})")
                    return "", detected_lang, stt_duration

            return text, detected_lang, stt_duration
        else:
            print(f"[STT] Groq Whisper error status {res.status_code}: {res.text}")
            return "", language_hint or "en", stt_duration
    except Exception as e:
        stt_duration = round(time.time() - start_time, 4)
        print(f"[STT] Groq Whisper exception: {e}")
        return "", language_hint or "en", stt_duration
