from unittest.mock import MagicMock
from app.models import FormField, Submission, FormVersion
from app.services.session import FormSessionManager
from app.services.filters import check_hallucination_filter
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

def create_mock_session():
    version = MagicMock(spec=FormVersion)
    version.id = 1
    version.version_number = 1

    f1 = create_mock_field(1, "full_name", "String", position=0)
    f2 = create_mock_field(2, "age", "Number", position=1)
    f3 = create_mock_field(3, "email", "Email", position=2)
    f4 = create_mock_field(4, "mobile_no", "Phone", position=3)
    version.fields = [f1, f2, f3, f4]

    submission = MagicMock(spec=Submission)
    submission.id = 303
    submission.form_id = 1
    submission.user_id = 15
    submission.status = "in_progress"
    submission.answers = []

    return FormSessionManager(submission, version)

# TEST 1: "Indian speaker." is dropped, creates no bubble, and does not change failure counter; "Yes" is not dropped
def test_indian_speaker_dropped_without_failure_penalty():
    session = create_mock_session()
    session.goto(2) # active field age (index 1)

    is_h, reason = check_hallucination_filter("Indian speaker.")
    assert is_h is True

    # Drop does NOT increment retry count
    assert session.retry_counts.get(1, 0) == 0

    # "Yes" is NOT dropped
    is_h_yes, _ = check_hallucination_filter("Yes")
    assert is_h_yes is False

# TEST 2: With age active and 2 failures, "My full name is wrong, can you go back?" goes to full_name, 0 failure count, resets counter
def test_my_full_name_is_wrong_resets_counter():
    session = create_mock_session()
    session.goto(2) # age field (index 1)
    session.increment_retry()
    session.increment_retry()
    assert session.retry_counts[1] == 2

    # Command detection for "My full name is wrong, can you go back?"
    nav_intent, target_id, amb, msg = parse_navigation_command("My full name is wrong, can you go back?", session.fields, session.get_current_field())
    assert nav_intent == "goto"
    assert target_id == 1 # full_name field id

    session.goto(target_id)
    assert session.get_current_field().id == 1
    assert session.retry_counts[0] == 0 # counter reset!

# TEST 3: Command family resolution
def test_command_family_resolutions():
    session = create_mock_session()
    fields = session.fields
    age_field = fields[1]

    # "can you go back to my name question"
    intent, fid, amb, msg = parse_navigation_command("can you go back to my name question", fields, age_field)
    assert intent == "goto" and fid == 1

    # "full name is wrong"
    intent, fid, amb, msg = parse_navigation_command("full name is wrong", fields, age_field)
    assert intent == "goto" and fid == 1

    # "name was wrong"
    intent, fid, amb, msg = parse_navigation_command("name was wrong", fields, age_field)
    assert intent == "goto" and fid == 1

    # "that's wrong" (no field specified -> goes to previous field 1)
    intent, fid, amb, msg = parse_navigation_command("that's wrong", fields, age_field)
    assert intent == "goto" and fid == 1

    # "change my email"
    intent, fid, amb, msg = parse_navigation_command("change my email", fields, age_field)
    assert intent == "goto" and fid == 3

    # "edit phone"
    intent, fid, amb, msg = parse_navigation_command("edit phone", fields, age_field)
    assert intent == "goto" and fid == 4

    # "redo age"
    intent, fid, amb, msg = parse_navigation_command("redo age", fields, age_field)
    assert intent == "goto" and fid == 2

# TEST 4: Bare words "gmail", "email", "dot com" alone are NEVER commands
def test_bare_words_never_commands():
    session = create_mock_session()
    fields = session.fields
    age_field = fields[1]

    for word in ["gmail", "email", "dot com"]:
        intent, fid, amb, msg = parse_navigation_command(word, fields, age_field)
        assert intent is None

# TEST 5: Three genuine failed answers trigger fallback; three dropped noise segments do not
def test_failure_counter_isolation():
    session = create_mock_session()
    session.goto(2) # age field (index 1)

    # 3 dropped noise / hallucination segments
    for _ in range(3):
        is_h, _ = check_hallucination_filter("Indian speaker.")
        assert is_h is True
        # Dropped segment does NOT call increment_retry()

    assert session.retry_counts[1] == 0 # STILL 0!

    # 3 genuine failed extraction turns
    for _ in range(3):
        session.increment_retry()

    assert session.retry_counts[1] == 3 # Triggers fallback!

# TEST 6: Full Session Replay Harness (Name -> "Indian speaker." x 2 -> "My full name is wrong, can you go back?" -> Correct -> End)
def test_full_session_replay_with_prompt_leak_and_wrong_name_command():
    session = create_mock_session()

    # Step 1: Name -> "Artie"
    session.record_answer(1, "Artie", "My name is Artie", "en")
    session.advance()
    assert session.get_current_field().field_name == "age"

    # Step 2: Prompt leak "Indian speaker." twice on age question
    for _ in range(2):
        is_h, _ = check_hallucination_filter("Indian speaker.")
        assert is_h is True
        # Dropped, 0 retries counted
    assert session.retry_counts[1] == 0

    # Step 3: Say "My full name is wrong, can you go back?"
    nav_intent, target_id, amb, msg = parse_navigation_command("My full name is wrong, can you go back?", session.fields, session.get_current_field())
    assert nav_intent == "goto"
    assert target_id == 1

    session.goto(target_id)
    assert session.get_current_field().id == 1
    assert session.mode == "editing"

    # Step 4: Correct name -> "Artie Svandararajan"
    session.record_answer(1, "Artie Svandararajan", "Artie Svandararajan", "en")
    session.advance()

    # Step 5: Complete age, email, phone
    assert session.get_current_field().field_name == "age"
    session.record_answer(2, "25", "25", "en")
    session.advance()

    assert session.get_current_field().field_name == "email"
    session.record_answer(3, "artie@gmail.com", "artie at gmail.com", "en")
    session.advance()

    assert session.get_current_field().field_name == "mobile_no"
    session.record_answer(4, "9080965547", "9080965547", "en")
    is_complete = session.advance()

    assert is_complete is True
    assert session.answers[1]["value"] == "Artie Svandararajan"
    assert session.answers[2]["value"] == "25"
    assert session.answers[3]["value"] == "artie@gmail.com"
    assert session.answers[4]["value"] == "9080965547"
