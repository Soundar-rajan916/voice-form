import pytest
from unittest.mock import MagicMock
from app.models import FormField, Submission, FormVersion
from app.services.session import FormSessionManager
from app.services.navigation import parse_navigation_command

def create_mock_field(id: int, name: str, data_type: str, required: bool = True, position: int = 0):
    field = MagicMock(spec=FormField)
    field.id = id
    field.field_name = name
    field.data_type = data_type
    field.description = f"User's {name}"
    field.required = required
    field.position = position
    field.choices = None
    field.question_en = f"What is your {name}?"
    field.question_ta = f"உங்கள் {name} என்ன?"
    return field

def create_mock_session(status: str = "in_progress"):
    version = MagicMock(spec=FormVersion)
    version.id = 1
    version.version_number = 1

    f1 = create_mock_field(1, "full_name", "String", position=0)
    f2 = create_mock_field(2, "email", "Email", position=1)
    f3 = create_mock_field(3, "phone", "Phone", position=2)
    f4 = create_mock_field(4, "age", "Number", position=3)
    version.fields = [f1, f2, f3, f4]

    submission = MagicMock(spec=Submission)
    submission.id = 101
    submission.form_id = 1
    submission.user_id = 42
    submission.status = status
    submission.answers = []

    return FormSessionManager(submission, version)

def test_back_from_field_3():
    session = create_mock_session()
    session.record_answer(1, "Artie", "my name is Artie", "en")
    session.record_answer(2, "artie@test.com", "artie at test.com", "en")
    session.current_field_index = 2

    assert session.get_current_field().id == 3
    moved = session.go_back()

    assert moved is True
    assert session.get_current_field().id == 2
    assert session.answers[1]["value"] == "Artie"
    assert session.answers[2]["value"] == "artie@test.com"

def test_goto_after_all_answered():
    session = create_mock_session()
    session.record_answer(1, "Artie Wrong", "my name is Artie Wrong", "en")
    session.record_answer(2, "artie@test.com", "artie at test.com", "en")
    session.record_answer(3, "9080965547", "9080965547", "en")
    session.record_answer(4, "25", "25", "en")
    session.update_current_field_index()
    assert session.is_complete() is True

    goto_ok = session.goto(1)
    assert goto_ok is True
    assert session.mode == "editing"
    assert session.editing_field_id == 1
    assert session.get_current_field().id == 1

    session.record_answer(1, "Artie Svandararajan", "Artie Svandararajan", "en")
    is_done = session.advance()

    assert is_done is True
    assert session.mode == "normal"
    assert session.editing_field_id is None
    assert session.answers[1]["value"] == "Artie Svandararajan"
    assert session.is_complete() is True

def test_goto_partial_form():
    session = create_mock_session()
    session.record_answer(1, "Artie Wrong", "Artie Wrong", "en")
    session.record_answer(2, "artie@test.com", "artie at test.com", "en")
    session.update_current_field_index()
    assert session.get_current_field().id == 3

    session.goto(1)
    assert session.mode == "editing"
    assert session.get_current_field().id == 1

    session.record_answer(1, "Artie Corrected", "Artie Corrected", "en")
    is_done = session.advance()

    assert is_done is False
    assert session.mode == "normal"
    assert session.get_current_field().id == 3

def test_undo_last():
    session = create_mock_session()
    session.record_answer(1, "Artie", "Artie", "en")
    session.record_answer(2, "artie@test.com", "artie at test.com", "en")

    undone_id = session.undo_last()
    assert undone_id == 2
    assert 2 not in session.answers
    assert 1 in session.answers
    assert session.get_current_field().id == 2

def test_locked_completed_submission():
    session = create_mock_session(status="completed")
    assert session.is_locked() is True


@pytest.mark.parametrize("state", [
    "fresh", "failed_attempt", "fallback_offered", "editing_mode", "confirmation_step", "spell_mode"
])
def test_navigation_from_all_email_states(state):
    """
    Asserts navigation (pencil/goto, back, undo, cancel) works from every email state,
    leaving saved answers untouched and moving off email field (id 2).
    """
    session = create_mock_session()
    # Fill full_name (id 1)
    session.record_answer(1, "Artie", "my name is Artie", "en")
    session.update_current_field_index() # active is email (id 2)
    assert session.get_current_field().id == 2

    if state == "failed_attempt":
        session.increment_retry()
    elif state == "fallback_offered":
        session.increment_retry()
        session.increment_retry()
        session.increment_retry()
    elif state == "editing_mode":
        session.goto(2) # editing email
    elif state == "confirmation_step":
        session.append_accumulated_transcript("artie at")
    elif state == "spell_mode":
        session.append_accumulated_transcript("a r t i e")

    # Saved answer before nav
    orig_name_ans = session.answers[1]["value"]

    # Action 1: Pencil goto full_name (id 1)
    session.goto(1)
    assert session.get_current_field().id == 1
    assert session.answers[1]["value"] == orig_name_ans

    # Return to email for Action 2: Go back
    session.goto(2)
    assert session.get_current_field().id == 2
    moved = session.go_back()
    assert moved is True
    assert session.get_current_field().id == 1
    assert session.answers[1]["value"] == orig_name_ans


def test_command_phrase_wins_over_email_utterance():
    """
    Utterance containing command words ('go back', 'change') beginning with command phrase
    is parsed as a navigation command.
    """
    fields = [
        create_mock_field(1, "full_name", "String", position=0),
        create_mock_field(2, "email", "Email", position=1),
        create_mock_field(3, "phone", "Phone", position=2)
    ]
    email_field = fields[1]

    # 'go back' while on email
    intent, target_id, amb, msg = parse_navigation_command("go back", fields, email_field)
    assert intent in ["back", "goto"]

    # 'change my name' while on email
    intent, target_id, amb, msg = parse_navigation_command("change my name", fields, email_field)
    assert intent == "goto"
    assert target_id == 1

    # 'my full name is wrong' while on email
    intent, target_id, amb, msg = parse_navigation_command("my full name is wrong", fields, email_field)
    assert intent == "goto"
    assert target_id == 1

