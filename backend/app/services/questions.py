import json
import re
import httpx
from typing import Tuple, Optional
from app.config import settings

GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"

_httpx_client: Optional[httpx.AsyncClient] = None

def get_httpx_client() -> httpx.AsyncClient:
    global _httpx_client
    if _httpx_client is None or _httpx_client.is_closed:
        _httpx_client = httpx.AsyncClient(timeout=10.0)
    return _httpx_client

async def generate_field_questions(
    field_name: str,
    description: str,
    data_type: str,
    choices: Optional[list] = None
) -> Tuple[str, str]:
    """
    Generates clean, well-formed question_en and question_ta for a form field at publish time.
    """
    if not settings.GROQ_API_KEY or settings.GROQ_API_KEY.startswith("gsk_dummy"):
        return _fallback_questions(field_name, description, data_type, choices)

    client = get_httpx_client()
    desc = description if description and description.strip() else f"{field_name} of the user"

    prompt = f"""You are a professional form designer for a voice chatbot app.
Generate two concise, perfectly capitalized, polite questions (one in English, one in Tamil script) asking the user to provide their '{field_name}'.

FIELD DETAILS:
- field_name: "{field_name}"
- description: "{desc}"
- data_type: "{data_type}"
- choices: {choices if choices else "None"}

RULES:
1. Questions must be well-formed, polite, capitalized, and end with a question mark.
2. English question must be natural (e.g. "What is your full name?", "May I have your email address?").
3. Tamil question must be in natural Tamil script (e.g. "உங்கள் முழு பெயர் என்ன?", "உங்கள் மின்னஞ்சல் முகவரியைக் கூற முடியுமா?").

OUTPUT FORMAT MUST BE VALID JSON ONLY:
{{
  "question_en": "Your English question here?",
  "question_ta": "உங்கள் தமிழ் கேள்வி இங்கே?"
}}"""

    headers = {
        "Authorization": f"Bearer {settings.GROQ_API_KEY}",
        "Content-Type": "application/json"
    }

    payload = {
        "model": settings.GROQ_LLM_MODEL,
        "messages": [
            {"role": "system", "content": "You output only valid JSON with keys question_en and question_ta."},
            {"role": "user", "content": prompt}
        ],
        "temperature": 0.0,
        "response_format": {"type": "json_object"},
        "max_tokens": 150
    }

    try:
        res = await client.post(GROQ_API_URL, headers=headers, json=payload)
        if res.status_code == 200:
            data = res.json()
            content = data["choices"][0]["message"]["content"]
            # Clean json
            text = content.strip()
            if text.startswith("```"):
                text = re.sub(r"^```(?:json)?\n?", "", text, flags=re.IGNORECASE)
                text = re.sub(r"\n?```$", "", text)
            parsed = json.loads(text)
            q_en = parsed.get("question_en", "").strip()
            q_ta = parsed.get("question_ta", "").strip()
            if q_en and q_ta:
                return q_en, q_ta
    except Exception as e:
        print(f"[Questions] Groq call failed or timed out: {e}. Using fallback templates.")

    return _fallback_questions(field_name, description, data_type, choices)

def _fallback_questions(field_name: str, description: str, data_type: str, choices: Optional[list] = None) -> Tuple[str, str]:
    cleaned_name = field_name.replace("_", " ").title()
    desc = description if description and description.strip() else cleaned_name

    q_en = f"What is your {cleaned_name}?"
    q_ta = f"உங்கள் {cleaned_name} என்ன?"

    if choices:
        choices_str = ", ".join(choices)
        q_en += f" (Options: {choices_str})"
        q_ta += f" (தேர்வுகள்: {choices_str})"
    return q_en, q_ta
