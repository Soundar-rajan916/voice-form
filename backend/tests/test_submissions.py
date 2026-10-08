import pytest
from httpx import AsyncClient
from app.services.session import FormSessionManager
from app.models import FormVersion, FormField, Submission, SubmissionAnswer

class MockVersion:
    def __init__(self, fields):
        self.id = 1
        self.version_number = 1
        self.fields = fields

class MockSubmission:
    def __init__(self, sub_id=1, form_id=1, user_id=1):
        self.id = sub_id
        self.form_id = form_id
        self.user_id = user_id
        self.answers = []

@pytest.mark.asyncio
async def test_4_field_form_state_machine():
    fields = [
        FormField(id=1, field_name="full_name", data_type="String", description="Full name", required=True, position=0),
        FormField(id=2, field_name="age", data_type="Number", description="Age in years", required=True, position=1),
        FormField(id=3, field_name="email", data_type="Email", description="Email address", required=True, position=2),
        FormField(id=4, field_name="mobile_no", data_type="Phone", description="Mobile number", required=True, position=3),
    ]

    version = MockVersion(fields)
    submission = MockSubmission()

    session = FormSessionManager(submission, version)

    # Initial state: field 0 (full_name), done = False
    state0 = session.build_state_dict()
    assert state0["current_field"]["field_name"] == "full_name"
    assert state0["current_field_index"] == 0
    assert state0["done"] is False

    # Answer 1: full_name -> "Soundararajan"
    session.record_answer(field_id=1, value="Soundararajan", raw_transcript="my name is Soundararajan", language="en")
    session.advance()

    state1 = session.build_state_dict()
    assert state1["current_field"]["field_name"] == "age"
    assert state1["current_field_index"] == 1
    assert state1["answered_count"] == 1
    assert state1["done"] is False # Must NOT be done after field 1!

    # Duplicate answer or confirm to field 1 -> should NOT skip age
    session.record_answer(field_id=1, value="Soundararajan", raw_transcript="confirm", language="en")
    session.advance()

    state1_dup = session.build_state_dict()
    assert state1_dup["current_field"]["field_name"] == "age"
    assert state1_dup["current_field_index"] == 1
    assert state1_dup["done"] is False

    # Answer 2: age -> "25"
    session.record_answer(field_id=2, value="25", raw_transcript="25", language="en")
    session.advance()

    state2 = session.build_state_dict()
    assert state2["current_field"]["field_name"] == "email"
    assert state2["current_field_index"] == 2
    assert state2["done"] is False

    # Answer 3: email -> "soundar@example.com"
    session.record_answer(field_id=3, value="soundar@example.com", raw_transcript="soundar at example dot com", language="en")
    session.advance()

    state3 = session.build_state_dict()
    assert state3["current_field"]["field_name"] == "mobile_no"
    assert state3["current_field_index"] == 3
    assert state3["done"] is False

    # Answer 4: mobile_no -> "9840012345"
    session.record_answer(field_id=4, value="9840012345", raw_transcript="9840012345", language="en")
    session.advance()

    state4 = session.build_state_dict()
    assert state4["current_field"] is None or state4["answered_count"] == 4
    assert state4["done"] is True # Done ONLY after all 4 required fields are answered!
