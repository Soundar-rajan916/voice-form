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
    valid_age_ok, clean_age, _ = validate_rule("25", "Number")
    assert valid_age_ok is True
    assert clean_age == "25"

    valid_age_over, _, err_age = validate_rule("105", "Number")
    assert valid_age_over is False
    assert "under 100" in err_age

    valid_age_neg, _, err_neg = validate_rule("-5", "Number")
    assert valid_age_neg is False
    assert "under 100" in err_neg
