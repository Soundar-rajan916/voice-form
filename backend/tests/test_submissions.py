import pytest
from httpx import AsyncClient
from app.services.session import FormSessionManager
from app.models import FormField

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
    assert state4["all_answered"] is True # All fields answered
    assert state4["done"] is False # Form is in_progress, NOT submitted/locked yet!


@pytest.mark.asyncio
async def test_submission_name_formatting(client: AsyncClient, admin_token_headers, user_token_headers):
    # 1. Create and publish form 'welfare'
    f1_resp = await client.post(
        "/admin/forms",
        json={
            "title": "welfare",
            "description": "Welfare assistance",
            "fields": [
                {"field_name": "applicant_name", "data_type": "String", "description": "Applicant Name", "required": True, "position": 0}
            ]
        },
        headers=admin_token_headers
    )
    assert f1_resp.status_code == 201
    f1_id = f1_resp.json()["id"]
    await client.post(f"/admin/forms/{f1_id}/publish", headers=admin_token_headers)

    # 2. Create and publish form 'General Form'
    f2_resp = await client.post(
        "/admin/forms",
        json={
            "title": "General Form",
            "description": "General feedback",
            "fields": [
                {"field_name": "feedback", "data_type": "String", "description": "Feedback", "required": True, "position": 0}
            ]
        },
        headers=admin_token_headers
    )
    assert f2_resp.status_code == 201
    f2_id = f2_resp.json()["id"]
    await client.post(f"/admin/forms/{f2_id}/publish", headers=admin_token_headers)

    # 3. Create sub 1 for welfare -> welfare
    sub1_res = await client.post(f"/forms/{f1_id}/submissions", headers=user_token_headers)
    assert sub1_res.status_code == 201
    sub1_data = sub1_res.json()
    assert sub1_data["submission_title"] == "welfare"
    assert sub1_data["submission_name"] == "welfare"

    # 4. Create sub 2 for welfare -> welfare
    sub2_res = await client.post(f"/forms/{f1_id}/submissions", headers=user_token_headers)
    assert sub2_res.status_code == 201
    sub2_data = sub2_res.json()
    assert sub2_data["submission_title"] == "welfare"
    assert sub2_data["submission_name"] == "welfare"

    # 5. Create sub 1 for General Form -> general form
    sub3_res = await client.post(f"/forms/{f2_id}/submissions", headers=user_token_headers)
    assert sub3_res.status_code == 201
    sub3_data = sub3_res.json()
    assert sub3_data["submission_title"] == "general form"
    assert sub3_data["submission_name"] == "general form"

    # 6. Verify list_user_submissions returns formatted names
    list_res = await client.get("/submissions", headers=user_token_headers)
    assert list_res.status_code == 200
    list_data = list_res.json()
    titles = [s["submission_title"] for s in list_data]
    assert "welfare" in titles
    assert "general form" in titles


@pytest.mark.asyncio
async def test_user_cannot_delete_completed_submission(client: AsyncClient, admin_token_headers, user_token_headers):
    # Create and publish a form
    f_res = await client.post(
        "/admin/forms",
        json={
            "title": "Feedback Form",
            "description": "User feedback",
            "fields": [
                {"field_name": "comment", "data_type": "String", "description": "Comment", "required": True, "position": 0}
            ]
        },
        headers=admin_token_headers
    )
    f_id = f_res.json()["id"]
    await client.post(f"/admin/forms/{f_id}/publish", headers=admin_token_headers)

    # User starts submission
    sub_res = await client.post(f"/forms/{f_id}/submissions", headers=user_token_headers)
    sub_id = sub_res.json()["id"]

    # Complete the submission
    field_id = sub_res.json()["fields"][0]["id"]
    comp_res = await client.post(
        f"/submissions/{sub_id}/complete",
        json=[{"field_id": field_id, "value": "Great app!"}],
        headers=user_token_headers
    )
    assert comp_res.status_code == 200
    assert comp_res.json()["status"] in ["submitted", "completed"]

    # User tries to delete completed submission -> must fail with 400
    del_res = await client.delete(f"/submissions/{sub_id}", headers=user_token_headers)
    assert del_res.status_code == 400
    assert del_res.json()["detail"] == "Submitted forms cannot be deleted"


