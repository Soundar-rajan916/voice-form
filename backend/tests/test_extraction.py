import pytest
from app.services.validation import fast_path_validate, validate_rule
from app.services.extraction import extract_answer, _clean_json_response
from app.schemas import ExtractionResult

def test_string_field_never_takes_fast_path():
    # String field must NEVER take fast path
    is_fast, val = fast_path_validate("My name is Artie Svandararajan.", "String")
    assert is_fast is False
    assert val is None

def test_fast_path_validation_true_cases():
    # Number fast path
    is_fast, val = fast_path_validate("9840012345", "Phone")
    assert is_fast is True
    assert val == "9840012345"

    # Boolean fast path
    is_fast_b, val_b = fast_path_validate("ஆமாம்", "Boolean")
    assert is_fast_b is True
    assert val_b == "Yes"

    # Choice fast path
    is_fast_c, val_c = fast_path_validate("Option A", "Choice", choices=["Option A", "Option B"])
    assert is_fast_c is True
    assert val_c == "Option A"

def test_clean_json_response_markdown_stripping():
    raw_fence = "```json\n{\n  \"intent\": \"answer\",\n  \"value\": \"Artie Svandararajan\",\n  \"fulfilled\": true\n}\n```"
    cleaned = _clean_json_response(raw_fence)
    assert cleaned.startswith("{")
    assert cleaned.endswith("}")

@pytest.mark.asyncio
async def test_extract_answer_refines_name():
    # Test that full_name transcript "My name is Artie Svandararajan." extracts "Artie Svandararajan"
    result, dur, path = await extract_answer(
        field_name="full_name",
        data_type="String",
        description="full name of the user",
        transcript="My name is Artie Svandararajan."
    )
    assert result.intent == "answer"
    assert "Artie Svandararajan" in result.value
    # Ensure filler words like "My name is" are stripped
    assert not result.value.startswith("My name is")

@pytest.mark.asyncio
async def test_spoken_email_normalization():
    result, dur, path = await extract_answer(
        field_name="email",
        data_type="Email",
        description="user email address",
        transcript="sabari at the rate gmail dot com"
    )
    assert result.value == "sabari@gmail.com"
    assert result.fulfilled is True

def test_rule_validation():
    # Email symbol normalization
    valid_e, clean_e, _ = validate_rule("sabari at the rate gmail dot com", "Email")
    assert valid_e is True
    assert clean_e == "sabari@gmail.com"

    # Invalid Phone
    valid_p, _, err_p = validate_rule("123", "Phone")
    assert valid_p is False
    assert "10 digits" in err_p

    # Date
    valid_d, clean_d, _ = validate_rule("2026-10-08", "Date")
    assert valid_d is True
    assert clean_d == "2026-10-08"

    # Age under 100 validation
    valid_age_ok, clean_age, _ = validate_rule("25", "Number", field_name="age")
    assert valid_age_ok is True
    assert clean_age == "25"

    valid_age_over, _, err_age = validate_rule("105", "Number", field_name="age")
    assert valid_age_over is False
    assert "under 100" in err_age

    valid_age_neg, _, err_neg = validate_rule("-5", "Number", field_name="age")
    assert valid_age_neg is False
    assert "under 100" in err_neg

    # General number (e.g. monthly_income) validation allows numbers >= 100
    valid_inc_ok, clean_inc, _ = validate_rule("50000", "Number", field_name="monthly_income")
    assert valid_inc_ok is True
    assert clean_inc == "50000"

def test_strip_emojis_removes_various_emojis():
    from app.services.filters import strip_emojis
    assert strip_emojis("Hello 😊 World! 🎉") == "Hello World!"
    assert strip_emojis("Soundararajan 👍") == "Soundararajan"
    assert strip_emojis("Tamil: என் பெயர் சவுந்தரராஜன் 🚀") == "Tamil: என் பெயர் சவுந்தரராஜன்"
    assert strip_emojis("⭐ Phone: 9080965547 📱") == "Phone: 9080965547"
    assert strip_emojis(None) == ""
    assert strip_emojis("") == ""

@pytest.mark.asyncio
async def test_extract_answer_strips_emojis_from_value():
    result, dur, path = await extract_answer(
        field_name="full_name",
        data_type="String",
        description="full name of the user",
        transcript="My name is Soundararajan 😊"
    )
    assert "😊" not in result.value
    assert result.value == "Soundararajan"

def test_gender_homophones_fast_path_and_validation():
    choices = ["Male", "Female", "Transgender"]

    # "mail" transcribed by STT must resolve to "Male", NOT "Female"
    is_fast, val = fast_path_validate("mail", "Choice", choices=choices, field_name="gender")
    assert is_fast is True
    assert val == "Male"

    valid, clean, err = validate_rule("mail", "Choice", choices=choices, field_name="gender")
    assert valid is True
    assert clean == "Male"

    # "females" transcribed by STT must resolve to "Female"
    is_fast_f, val_f = fast_path_validate("females", "Choice", choices=choices, field_name="gender")
    assert is_fast_f is True
    assert val_f == "Female"

    valid_f, clean_f, err_f = validate_rule("females", "Choice", choices=choices, field_name="gender")
    assert valid_f is True
    assert clean_f == "Female"

def test_gender_normalizer():
    from app.services.normalizer import normalize_transcript
    assert normalize_transcript("mail", "Choice", "gender") == "Male"
    assert normalize_transcript("females", "Choice", "gender") == "Female"
    assert normalize_transcript("ஆண்", "Choice", "gender") == "Male"


