import time
import httpx
from typing import Optional, Tuple
from app.config import settings
from app.services.questions import get_httpx_client

GROQ_STT_URL = "https://api.groq.com/openai/v1/audio/transcriptions"
SARVAM_STT_URL = "https://api.sarvam.ai/speech-to-text"

async def transcribe_audio_wav(
    audio_bytes: bytes,
    language_hint: Optional[str] = None,
    field_description: Optional[str] = None
) -> Tuple[str, str, float]:
    """
    Transcribes binary WAV audio using Sarvam AI STT or Groq Whisper API based on settings.STT_PROVIDER.
    If no API key is set for the selected provider, gracefully falls back to available STT provider or simulated test transcript.
    Returns (transcript_text, detected_language, stt_duration_seconds).
    """
    start_time = time.time()
    provider = (settings.STT_PROVIDER or "groq").lower()

    if provider == "sarvam":
        if settings.SARVAM_API_KEY and not settings.SARVAM_API_KEY.startswith("dummy"):
            print(f"[STT Service] Transcribing via Sarvam AI API (Model: {settings.SARVAM_STT_MODEL})...")
            return await _transcribe_sarvam(audio_bytes, language_hint, start_time)
        elif settings.GROQ_API_KEY and not settings.GROQ_API_KEY.startswith("gsk_dummy"):
            print(f"[STT Service] Sarvam API key not set. Falling back to Groq Whisper API ({settings.GROQ_STT_MODEL})...")
            return await _transcribe_groq(audio_bytes, language_hint, start_time)
        else:
            print(f"[STT Service] No API keys configured. Using Local Simulation Mode...")
            stt_duration = round(time.time() - start_time, 4)
            return "Simulated audio transcript", language_hint or "en", stt_duration

    if not settings.GROQ_API_KEY or settings.GROQ_API_KEY.startswith("gsk_dummy"):
        print(f"[STT Service] Groq API key not set. Using Local Simulation Mode...")
        stt_duration = round(time.time() - start_time, 4)
        return "Simulated audio transcript", language_hint or "en", stt_duration

    print(f"[STT Service] Transcribing via Groq Whisper API (Model: {settings.GROQ_STT_MODEL})...")
    return await _transcribe_groq(audio_bytes, language_hint, start_time)


async def _transcribe_sarvam(
    audio_bytes: bytes,
    language_hint: Optional[str],
    start_time: float
) -> Tuple[str, str, float]:
    """
    Transcribes audio using Sarvam AI Speech-to-Text API (saarika:v2 / saaras:v1).
    Optimized for Indian languages (Tamil ta-IN, English en-IN, Hindi hi-IN).
    """
    client = get_httpx_client()

    lang_code = "unknown"
    if language_hint == "ta":
        lang_code = "ta-IN"
    elif language_hint == "en":
        lang_code = "en-IN"

    files = {
        "file": ("audio.wav", audio_bytes, "audio/wav")
    }
    data = {
        "model": settings.SARVAM_STT_MODEL,
        "language_code": lang_code,
        "with_timings": "false"
    }
    headers = {
        "api-subscription-key": settings.SARVAM_API_KEY
    }

    try:
        res = await client.post(SARVAM_STT_URL, headers=headers, data=data, files=files)
        stt_duration = round(time.time() - start_time, 4)

        if res.status_code == 200:
            result_json = res.json()
            text = result_json.get("transcript", "").strip()
            detected_lang_code = result_json.get("language_code", lang_code)
            detected_lang = "ta" if "ta" in str(detected_lang_code).lower() else "en"
            print(f"[STT Service] Sarvam AI Success: '{text}' ({detected_lang}, {stt_duration}s)")
            return text, detected_lang, stt_duration
        else:
            print(f"[STT Service] Sarvam AI Error Status {res.status_code}: {res.text}")
            return "", language_hint or "en", stt_duration
    except Exception as e:
        stt_duration = round(time.time() - start_time, 4)
        print(f"[STT Service] Sarvam AI Exception: {e}")
        return "", language_hint or "en", stt_duration


async def _transcribe_groq(
    audio_bytes: bytes,
    language_hint: Optional[str],
    start_time: float
) -> Tuple[str, str, float]:
    """
    Transcribes audio using Groq Whisper API.
    """
    client = get_httpx_client()

    files = {
        "file": ("audio.wav", audio_bytes, "audio/wav")
    }
    data = {
        "model": settings.GROQ_STT_MODEL,
        "response_format": "verbose_json"
    }

    if language_hint and language_hint in ["en", "ta"]:
        data["language"] = language_hint

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

            # Verbose segment metadata filtering
            segments = result_json.get("segments", [])
            for seg in segments:
                no_speech_prob = seg.get("no_speech_prob", 0.0)
                avg_logprob = seg.get("avg_logprob", 0.0)
                compression_ratio = seg.get("compression_ratio", 1.0)

                if no_speech_prob > 0.6 or avg_logprob < -1.0 or compression_ratio > 2.4:
                    print(f"[STT Metadata Drop] High no_speech_prob ({no_speech_prob:.2f}) or low avg_logprob ({avg_logprob:.2f})")
                    return "", detected_lang, stt_duration

            print(f"[STT Service] Groq Whisper Success: '{text}' ({detected_lang}, {stt_duration}s)")
            return text, detected_lang, stt_duration
        else:
            print(f"[STT Service] Groq Whisper Error Status {res.status_code}: {res.text}")
            return "", language_hint or "en", stt_duration
    except Exception as e:
        stt_duration = round(time.time() - start_time, 4)
        print(f"[STT Service] Groq Whisper Exception: {e}")
        return "", language_hint or "en", stt_duration
