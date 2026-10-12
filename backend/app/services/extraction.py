import json
import re
import time
from datetime import datetime
from typing import Tuple, Optional, List
from app.config import settings
from app.schemas import ExtractionResult
from app.services.questions import get_httpx_client
from app.services.validation import fast_path_validate, validate_rule

GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"

# Common conversational filler phrases to strip from extracted names
FILLER_PREFIXES = [
    r"^my name is\s+", r"^i am\s+", r"^name is\s+", r"^this is\s+",
    r"^yeah my name is\s+", r"^people call me\s+", r"^hi my name is\s+",
    r"^hello my name is\s+", r"^i'm\s+"
]

from app.services.filters import strip_emojis

def _refine_string_value(text: str, data_type: str) -> str:
    """Refines raw string value by removing conversational filler words, emojis, and normalizing symbols."""
    cleaned = strip_emojis(text).strip()

    if data_type == "String":
        for pattern in FILLER_PREFIXES:
            cleaned = re.sub(pattern, "", cleaned, flags=re.IGNORECASE)
        # Strip trailing punctuation
        cleaned = cleaned.rstrip(".!?,")
        return cleaned.strip()

    elif data_type == "Email":
        email_clean = cleaned.lower()
        email_clean = email_clean.replace(" at the rate ", "@").replace(" at ", "@")
        email_clean = email_clean.replace(" dot ", ".").replace(" ", "")
        email_clean = email_clean.rstrip(".!?,")
        return email_clean

    return cleaned.rstrip(".!?,")

def _clean_json_response(raw_text: str) -> str:
    """Strips markdown code fences ```json ... ``` from LLM response."""
    text = raw_text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\n?", "", text, flags=re.IGNORECASE)
        text = re.sub(r"\n?```$", "", text)
    return text.strip()

async def extract_answer(
    field_name: str,
    data_type: str,
    description: str,
    transcript: str,
    choices: Optional[List[str]] = None,
    language_hint: Optional[str] = "en",
    accumulated_transcript: Optional[str] = None
) -> Tuple[ExtractionResult, float, str]:
    """
    Extracts structured answer from user transcript using Fast Path or Groq LLM.
    Returns (ExtractionResult, duration_seconds, path_taken).
    """
    start_time = time.time()
    combined_transcript = f"{accumulated_transcript} {transcript}".strip() if accumulated_transcript else transcript.strip()
    desc = description if description and description.strip() else f"value for {field_name}"

    # 1. FAST PATH CHECK (String fields NEVER take fast path)
    is_fast_path, fast_val = fast_path_validate(combined_transcript, data_type, choices, field_name=field_name)
    if is_fast_path:
        dur = round(time.time() - start_time, 4)
        print(f"[Extraction Path=fast_path] Field='{field_name}' Type='{data_type}' Extracted='{fast_val}' Latency={dur}s")
        return ExtractionResult(
            intent="answer",
            value=fast_val,
            fulfilled=True,
            incomplete=False,
            follow_up=None
        ), dur, "fast_path"

    # Check if Groq API Key is unconfigured/dummy
    if not settings.GROQ_API_KEY or settings.GROQ_API_KEY.startswith("gsk_dummy"):
        refined = _refine_string_value(combined_transcript, data_type)
        is_valid, cleaned_val, err = validate_rule(refined, data_type, choices)
        dur = round(time.time() - start_time, 4)

        if is_valid:
            print(f"[Extraction Path=rule_refine] Field='{field_name}' Value='{cleaned_val}'")
            return ExtractionResult(
                intent="answer",
                value=cleaned_val,
                fulfilled=True,
                incomplete=False,
                follow_up=None
            ), dur, "rule_refine"
        else:
            return ExtractionResult(
                intent="answer",
                value=refined,
                fulfilled=False,
                incomplete=False,
                follow_up=f"Could not extract a valid {field_name} ({err}). Please try again or type your answer."
            ), dur, "fallback_error"

    # 2. LLM EXTRACTION CALL WITH FEW-SHOT PROMPTING
    client = get_httpx_client()
    today_str = datetime.utcnow().strftime("%Y-%m-%d")

    system_prompt = f"""You are an elite, high-accuracy answer extraction engine for a voice form chatbot.
Your sole job is to extract ONLY the clean, refined answer value that satisfies the target field description.

TODAY'S DATE: {today_str}

TARGET FIELD SCHEMA:
- field-name: "{field_name}"
- data-type: "{data_type}"
- description: "{desc}"
- choices: {choices if choices else "None"}
- user-language: {language_hint}

FEW-SHOT EXAMPLES:
1. Input: "My name is Artie Svandararajan." (field: "full_name", description: "full name of the user")
   Output: {{"intent": "answer", "value": "Artie Svandararajan", "fulfilled": true, "incomplete": false, "follow_up": null}}
2. Input: "Yeah my name is Soundararajan, people call me Soundar." (field: "full_name", description: "full name of the user")
   Output: {{"intent": "answer", "value": "Soundararajan", "fulfilled": true, "incomplete": false, "follow_up": null}}
3. Input: "sabari at the rate gmail dot com" (field: "email", description: "user email address")
   Output: {{"intent": "answer", "value": "sabari@gmail.com", "fulfilled": true, "incomplete": false, "follow_up": null}}
4. Input: "என் பெயர் சவுந்தரராஜன்" (field: "full_name", description: "full name of the user")
   Output: {{"intent": "answer", "value": "சவுந்தரராஜன்", "fulfilled": true, "incomplete": false, "follow_up": null}}
5. Input: "my phone number is 908096" (field: "mobile_no", description: "10 digit phone number")
   Output: {{"intent": "answer", "value": "908096", "fulfilled": false, "incomplete": true, "follow_up": "Your phone number is missing 4 digits. Could you please provide the full 10 digits?"}}

EXTRACTION RULES:
1. Extract ONLY the value that satisfies the description. Strip filler words ("my name is", "people call me"), conversational prefixes, and trailing periods.
2. Convert spoken digits/numbers in Tamil or English to numeric digits ("five" -> "5").
3. Convert spoken email phrases ("at the rate", "dot com") to standard email symbols.
4. If the answer is incomplete, set incomplete = true, fulfilled = false, and write a targeted follow-up in the user's language asking ONLY for what is missing.
5. If the utterance does not satisfy the description, set fulfilled = false and provide a polite, targeted follow-up asking for what is missing (NEVER repeat the original question word-for-word).
6. CRITICAL: NEVER return or include ANY emojis, emoticons, or pictographs under any circumstances. Both 'value' and 'follow_up' MUST be clean plain text only without any emojis.

OUTPUT FORMAT: STRICT JSON ONLY with keys: intent, value, fulfilled, incomplete, follow_up, target_field."""

    user_prompt = f"<USER_TRANSCRIPT>\n{combined_transcript}\n</USER_TRANSCRIPT>"

    headers = {
        "Authorization": f"Bearer {settings.GROQ_API_KEY}",
        "Content-Type": "application/json"
    }

    payload = {
        "model": settings.GROQ_LLM_MODEL,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ],
        "temperature": 0.0,
        "response_format": {"type": "json_object"},
        "max_tokens": 200
    }

    path_taken = "llm"

    for attempt in range(2):
        try:
            res = await client.post(GROQ_API_URL, headers=headers, json=payload)
            dur = round(time.time() - start_time, 4)

            if res.status_code == 200:
                data = res.json()
                raw_content = data["choices"][0]["message"]["content"]
                cleaned_json_str = _clean_json_response(raw_content)
                parsed = json.loads(cleaned_json_str)
                result = ExtractionResult.model_validate(parsed)

                if result.value:
                    result.value = strip_emojis(str(result.value))
                if result.follow_up:
                    result.follow_up = strip_emojis(result.follow_up) or None

                if result.intent == "answer" and result.value:
                    refined_val = _refine_string_value(result.value, data_type)
                    is_valid, cleaned_val, err = validate_rule(refined_val, data_type, choices, field_name=field_name)
                    if is_valid:
                        result.value = cleaned_val
                        result.fulfilled = True
                        result.incomplete = False
                    else:
                        result.fulfilled = False
                        if not result.follow_up:
                            result.follow_up = f"Please provide a valid {field_name}. ({err})"

                print(f"[Extraction Path={path_taken}] Field='{field_name}' Type='{data_type}' Value='{result.value}' Fulfilled={result.fulfilled} Latency={dur}s")
                return result, dur, path_taken

            else:
                print(f"[Extraction Groq LLM non-200] Status={res.status_code} Body={res.text}")

        except Exception as e:
            path_taken = "llm_retry"
            print(f"[Extraction Error Attempt {attempt + 1}] {e}")

    # Fallback refinement if LLM fails
    refined = _refine_string_value(combined_transcript, data_type)
    is_valid, cleaned_val, err = validate_rule(refined, data_type, choices, field_name=field_name)
    dur = round(time.time() - start_time, 4)
    if is_valid:
        return ExtractionResult(
            intent="answer",
            value=cleaned_val,
            fulfilled=True,
            incomplete=False,
            follow_up=None
        ), dur, "rule_fallback"

    return ExtractionResult(
        intent="answer",
        value=combined_transcript,
        fulfilled=False,
        incomplete=False,
        follow_up=f"Could not extract {field_name} from your response. Please try again or type your answer."
    ), dur, "fallback_error"
