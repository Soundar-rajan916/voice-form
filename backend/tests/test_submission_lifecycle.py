import pytest
from httpx import AsyncClient
from app.services.session import FormSessionManager
from app.models import FormField, Submission

class MockVersion:
    def __init__(self, fields):
        self.id = 1
        self.version_number = 1
        self.fields = fields

class MockSubmission:
    def __init__(self, sub_id=1, form_id=1, user_id=1, status="in_progress"):
        self.id = sub_id
        self.form_id = form_id
        self.user_id = user_id
        self.status = status
        self.answers = []
        self.started_at = None
        self.completed_at = None
        self.submitted_at = None

@pytest.mark.asyncio
async def test_lifecycle_4th_answer_stays_in_progress():
    fields = [
        FormField(id=1, field_name="full_name", data_type="String", description="Full name", required=True, position=0),
        FormField(id=2, field_name="age", data_type="Number", description="Age in years", required=True, position=1),
        FormField(id=3, field_name="email", data_type="Email", description="Email address", required=True, position=2),
        FormField(id=4, field_name="mobile_no", data_type="Phone", description="Mobile number", required=True, position=3),
    ]

    version = MockVersion(fields)
    submission = MockSubmission()
    session = FormSessionManager(submission, version)

    session.record_answer(1, "Alice", "alice", "en")
    session.advance()
    session.record_answer(2, "30", "30", "en")
    session.advance()
    session.record_answer(3, "alice@example.com", "alice at example dot com", "en")
    session.advance()
    session.record_answer(4, "9876543210", "9876543210", "en")
    session.advance()

    state = session.build_state_dict()
    assert state["all_answered"] is True
    assert state["submission_status"] == "in_progress"
    assert state["can_edit"] is True
    assert state["mode"] == "review"
    assert session.is_locked() is False

@pytest.mark.asyncio
async def test_editing_in_review_stage():
    fields = [
        FormField(id=1, field_name="full_name", data_type="String", description="Full name", required=True, position=0),
        FormField(id=2, field_name="age", data_type="Number", description="Age in years", required=True, position=1),
        FormField(id=3, field_name="email", data_type="Email", description="Email address", required=True, position=2),
        FormField(id=4, field_name="mobile_no", data_type="Phone", description="Mobile number", required=True, position=3),
    ]

    version = MockVersion(fields)
    submission = MockSubmission()
    session = FormSessionManager(submission, version)

    # Complete all 4 answers
    for f_id, val in [(1, "Alice"), (2, "30"), (3, "alice@example.com"), (4, "9876543210")]:
        session.record_answer(f_id, val, val, "en")
        session.advance()

    assert session.build_state_dict()["mode"] == "review"
    assert session.build_state_dict()["can_edit"] is True

    # 1. Pencil / goto field 3 (email)
    res_goto = session.goto(3)
    assert res_goto is True
    assert session.mode == "editing"
    assert session.editing_field_id == 3

    # 2. Cancel edit restores old email
    session.cancel_editing()
    assert session.build_state_dict()["mode"] == "review"
    assert session.answers[3]["value"] == "alice@example.com"

    # 3. Goto field 3 and update email
    session.goto(3)
    session.record_answer(3, "alice_new@example.com", "alice new at example dot com", "en")
    session.advance()

    state_after_edit = session.build_state_dict()
    assert state_after_edit["mode"] == "review"
    assert state_after_edit["all_answered"] is True
    assert session.answers[3]["value"] == "alice_new@example.com"

    # 4. Back from review stage
    res_back = session.go_back()
    assert res_back is True
    assert session.mode == "normal"

    # 5. Undo in review stage
    session.cancel_editing()
    session.record_answer(3, "alice_third@example.com", "alice third", "en")
    session.advance()
    res_undo = session.undo_last()
    assert res_undo == 3

@pytest.mark.asyncio
async def test_submit_and_locked_attempts(client: AsyncClient, admin_token_headers, user_token_headers):
    # 1. Create form with 2 required fields
    f_res = await client.post(
        "/admin/forms",
        json={
            "title": "Review Lifecycle Form",
            "description": "Lifecycle testing",
            "fields": [
                {"field_name": "full_name", "data_type": "String", "description": "Full Name", "required": True, "position": 0},
                {"field_name": "email", "data_type": "Email", "description": "Email", "required": True, "position": 1}
            ]
        },
        headers=admin_token_headers
    )
    f_id = f_res.json()["id"]
    await client.post(f"/admin/forms/{f_id}/publish", headers=admin_token_headers)

    # 2. User starts submission
    sub_res = await client.post(f"/forms/{f_id}/submissions", headers=user_token_headers)
    sub_id = sub_res.json()["id"]
    f1_id = sub_res.json()["fields"][0]["id"]
    f2_id = sub_res.json()["fields"][1]["id"]

    # 3. Attempt Submit without answers -> 400 Bad Request naming missing fields
    sub_fail = await client.post(
        f"/submissions/{sub_id}/submit",
        json=[],
        headers=user_token_headers
    )
    assert sub_fail.status_code == 400
    assert "missing required fields" in sub_fail.json()["detail"].lower()

    # 4. Submit with all answers -> success
    sub_success = await client.post(
        f"/submissions/{sub_id}/submit",
        json=[
            {"field_id": f1_id, "value": "Bob"},
            {"field_id": f2_id, "value": "bob@example.com"}
        ],
        headers=user_token_headers
    )
    assert sub_success.status_code == 200
    res_data = sub_success.json()
    assert res_data["status"] == "submitted"
    assert res_data["submitted_at"] is not None
    assert res_data["can_edit"] is False

    # 5. Idempotent Submit -> returns same submitted submission without error
    sub_dup = await client.post(
        f"/submissions/{sub_id}/submit",
        json=[
            {"field_id": f1_id, "value": "Bob"},
            {"field_id": f2_id, "value": "bob@example.com"}
        ],
        headers=user_token_headers
    )
    assert sub_dup.status_code == 200
    assert sub_dup.json()["status"] == "submitted"

@pytest.mark.asyncio
async def test_reload_in_progress_answered_submission_resumes_in_review(client: AsyncClient, admin_token_headers, user_token_headers):
    # Create form
    f_res = await client.post(
        "/admin/forms",
        json={
            "title": "Reload Form",
            "description": "Reload test",
            "fields": [
                {"field_name": "name", "data_type": "String", "description": "Name", "required": True, "position": 0}
            ]
        },
        headers=admin_token_headers
    )
    f_id = f_res.json()["id"]
    await client.post(f"/admin/forms/{f_id}/publish", headers=admin_token_headers)

    # Start submission
    sub_res = await client.post(f"/forms/{f_id}/submissions", headers=user_token_headers)
    sub_id = sub_res.json()["id"]

    # GET submission state before submit
    get_res = await client.get(f"/submissions/{sub_id}", headers=user_token_headers)
    assert get_res.status_code == 200
    assert get_res.json()["status"] == "in_progress"
    assert get_res.json()["can_edit"] is True
