import pytest
from unittest.mock import patch, MagicMock
from datetime import datetime

from app.services.email_service import (
    build_submission_email_content,
    send_email_sync,
    dispatch_submission_email
)
from app.config import settings
from app.models import User, Form, FormVersion, FormField, Submission, SubmissionAnswer

def test_build_submission_email_content():
    fields_data = [
        {"field_name": "applicant_name", "question": "What is your name?", "value": "Soundararajan"},
        {"field_name": "contact_phone", "question": "What is your phone number?", "value": "9080965547"},
        {"field_name": "aadhaar_number", "question": "Aadhaar number", "value": "•••• •••• 1234"},
    ]
    plain, html = build_submission_email_content(
        submission_id=146,
        form_title="Income Certificate",
        reference_number="REF-000146",
        submitted_at=datetime(2026, 10, 12, 14, 0, 0),
        fields_and_answers=fields_data,
        recipient_email="soundararajan916@gmail.com"
    )

    assert "Income Certificate" in plain
    assert "REF-000146" in plain
    assert "Soundararajan" in plain
    assert "•••• •••• 1234" in plain
    assert "soundararajan916@gmail.com" in plain

    assert "Income Certificate" in html
    assert "REF-000146" in html
    assert "Soundararajan" in html
    assert "•••• •••• 1234" in html
    assert "<table" in html

def test_send_email_sync_without_credentials_returns_false():
    with patch.object(settings, "SMTP_USER", ""), patch.object(settings, "SMTP_PASSWORD", ""):
        res = send_email_sync(
            recipient="test@gmail.com",
            subject="Test Subject",
            text_body="Test Body",
            html_body="<p>Test Body</p>"
        )
        assert res is False

def test_send_email_sync_with_mock_smtp():
    with patch.object(settings, "SMTP_USER", "sender@gmail.com"), \
         patch.object(settings, "SMTP_PASSWORD", "secretapppass123"), \
         patch.object(settings, "SMTP_HOST", "smtp.gmail.com"), \
         patch.object(settings, "SMTP_PORT", 587), \
         patch.object(settings, "ENABLE_EMAIL_NOTIFICATIONS", True), \
         patch("smtplib.SMTP") as mock_smtp_cls:

        mock_server = MagicMock()
        mock_smtp_cls.return_value.__enter__.return_value = mock_server

        res = send_email_sync(
            recipient="soundararajan916@gmail.com",
            subject="Form Submitted",
            text_body="Hello world",
            html_body="<p>Hello world</p>"
        )

        assert res is True
        mock_server.starttls.assert_called_once()
        mock_server.login.assert_called_once_with("sender@gmail.com", "secretapppass123")
        mock_server.send_message.assert_called_once()

@pytest.mark.asyncio
async def test_dispatch_submission_email(async_db_session):
    # Setup test user, form, version, field, submission
    user = User(
        email="soundararajan916@gmail.com",
        hashed_password="fake",
        role="user"
    )
    async_db_session.add(user)
    await async_db_session.flush()

    form = Form(title="Poverty Relief Form", created_by=user.id)
    async_db_session.add(form)
    await async_db_session.flush()

    version = FormVersion(form_id=form.id, version_number=1)
    async_db_session.add(version)
    await async_db_session.flush()

    field_name = FormField(
        form_version_id=version.id,
        field_name="full_name",
        data_type="String",
        description="Full Name",
        position=1,
        question_en="What is your full name?"
    )
    field_email = FormField(
        form_version_id=version.id,
        field_name="user_email",
        data_type="Email",
        description="Email address",
        position=2,
        question_en="What is your email address?"
    )
    async_db_session.add_all([field_name, field_email])
    await async_db_session.flush()

    submission = Submission(
        form_id=form.id,
        form_version_id=version.id,
        user_id=user.id,
        status="submitted",
        reference_number="REF-TEST-001"
    )
    async_db_session.add(submission)
    await async_db_session.flush()

    ans1 = SubmissionAnswer(
        submission_id=submission.id,
        field_id=field_name.id,
        value="Soundararajan",
        source="typed"
    )
    ans2 = SubmissionAnswer(
        submission_id=submission.id,
        field_id=field_email.id,
        value="soundararajan916@gmail.com",
        source="typed"
    )
    async_db_session.add_all([ans1, ans2])
    await async_db_session.commit()

    class MockSessionContext:
        async def __aenter__(self):
            return async_db_session
        async def __aexit__(self, exc_type, exc_val, exc_tb):
            pass

    with patch("app.services.email_service.send_email_sync", return_value=True) as mock_send, \
         patch("app.services.email_service.AsyncSessionLocal", side_effect=MockSessionContext):
        success = await dispatch_submission_email(submission.id)
        assert success is True
        assert mock_send.called
        # Check recipient was called with the gmail address
        call_recipient = mock_send.call_args[0][0]
        assert call_recipient == "soundararajan916@gmail.com"
        call_subject = mock_send.call_args[0][1]
        assert "Poverty Relief Form" in call_subject

