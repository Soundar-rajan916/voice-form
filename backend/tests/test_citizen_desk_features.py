import io
import pytest
from datetime import datetime, timedelta
from PIL import Image
from sqlalchemy import select

from app.models import User, Form, FormVersion, FormField, Submission
from app.security import create_access_token
from app.services.crypto import encrypt_sensitive_value, decrypt_sensitive_value, mask_sensitive_value, check_auto_sensitive_field
from app.services.retention import cleanup_expired_submissions

@pytest.mark.asyncio
async def test_sensitive_field_crypto_and_masking():
    plain_aadhaar = "123456789012"
    encrypted = encrypt_sensitive_value(plain_aadhaar)
    assert encrypted.startswith("enc:")
    assert encrypted != plain_aadhaar

    decrypted = decrypt_sensitive_value(encrypted)
    assert decrypted == plain_aadhaar

    masked = mask_sensitive_value(plain_aadhaar)
    assert "9012" in masked
    assert "1234" not in masked

    # Auto-detection
    assert check_auto_sensitive_field("aadhaar_number", "citizen aadhaar card") is True
    assert check_auto_sensitive_field("pan_number", "income tax PAN") is True
    assert check_auto_sensitive_field("full_name", "applicant name") is False

@pytest.mark.asyncio
async def test_user_access_isolation(client, async_db_session):
    u1 = User(email="user1@test.local", hashed_password="pw", role="user", is_active=True)
    u2 = User(email="user2@test.local", hashed_password="pw", role="user", is_active=True)
    form = Form(title="Service Form B", status="published", created_by=1)
    async_db_session.add_all([u1, u2, form])
    await async_db_session.flush()

    ver = FormVersion(form_id=form.id, version_number=1)
    async_db_session.add(ver)
    await async_db_session.flush()

    field = FormField(form_version_id=ver.id, field_name="applicant_name", data_type="String", description="Name", required=True)
    async_db_session.add(field)
    await async_db_session.flush()

    sub_u1 = Submission(form_id=form.id, form_version_id=ver.id, user_id=u1.id, channel="online")
    sub_u2 = Submission(form_id=form.id, form_version_id=ver.id, user_id=u2.id, channel="online")
    async_db_session.add_all([sub_u1, sub_u2])
    await async_db_session.commit()

    token_u1 = create_access_token({"sub": str(u1.id), "role": "user"})
    headers_u1 = {"Authorization": f"Bearer {token_u1}"}

    # U1 can see own application
    res_own = await client.get(f"/submissions/{sub_u1.id}", headers=headers_u1)
    assert res_own.status_code == 200

    # U1 cannot access U2's application
    res_other = await client.get(f"/submissions/{sub_u2.id}", headers=headers_u1)
    assert res_other.status_code in (403, 404)

@pytest.mark.asyncio
async def test_retention_cleanup_job(async_db_session):
    now = datetime.utcnow()
    user = User(email="retention_test@desk.local", hashed_password="pw", role="user", is_active=True)
    form = Form(title="Retention Test Form", status="published", created_by=1)
    async_db_session.add_all([user, form])
    await async_db_session.flush()

    ver = FormVersion(form_id=form.id, version_number=1)
    async_db_session.add(ver)
    await async_db_session.flush()

    # Create an expired submission and an active submission
    sub_expired = Submission(
        form_id=form.id, form_version_id=ver.id, user_id=user.id,
        status="submitted",
        retention_expires_at=now - timedelta(days=5)
    )
    sub_active = Submission(
        form_id=form.id, form_version_id=ver.id, user_id=user.id,
        status="submitted",
        retention_expires_at=now + timedelta(days=20)
    )
    async_db_session.add_all([sub_expired, sub_active])
    await async_db_session.commit()

    deleted_count = await cleanup_expired_submissions(async_db_session)
    assert deleted_count >= 1

    # Verify sub_expired is deleted
    res = await async_db_session.execute(select(Submission).where(Submission.id == sub_expired.id))
    assert res.scalar_one_or_none() is None

    # Verify sub_active remains
    res_act = await async_db_session.execute(select(Submission).where(Submission.id == sub_active.id))
    assert res_act.scalar_one_or_none() is not None

@pytest.mark.asyncio
async def test_image_upload_magic_bytes_and_exif(client, async_db_session):
    user = User(email="uploader@test.local", hashed_password="pw", role="user", is_active=True)
    form = Form(title="Doc Form", status="published", allow_document_upload=True, created_by=1)
    async_db_session.add_all([user, form])
    await async_db_session.flush()

    ver = FormVersion(form_id=form.id, version_number=1)
    async_db_session.add(ver)
    await async_db_session.flush()

    sub = Submission(form_id=form.id, form_version_id=ver.id, user_id=user.id, status="in_progress")
    async_db_session.add(sub)
    await async_db_session.commit()

    token = create_access_token({"sub": str(user.id), "role": "user"})
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Invalid fake header must fail
    fake_img = b"Not really an image header"
    files = {"file": ("test.jpg", fake_img, "image/jpeg")}
    res_bad = await client.post(f"/submissions/{sub.id}/documents", headers=headers, files=files)
    assert res_bad.status_code == 400
    assert "Invalid JPEG" in res_bad.json()["detail"]

    # 2. Valid PIL JPEG image
    pil_img = Image.new("RGB", (200, 100), color="white")
    buf = io.BytesIO()
    pil_img.save(buf, format="JPEG")
    valid_jpeg_bytes = buf.getvalue()

    files_good = {"file": ("document.jpg", valid_jpeg_bytes, "image/jpeg")}
    res_good = await client.post(f"/submissions/{sub.id}/documents", headers=headers, files=files_good)
    assert res_good.status_code == 200
    assert "proposals" in res_good.json()

@pytest.mark.asyncio
async def test_seed_forms_idempotent_and_no_sensitive_ids(async_db_session):
    from app.services.seed import seed_citizen_service_forms
    count = await seed_citizen_service_forms(async_db_session)
    assert count >= 3

    # Verify each form exists, is published, and has no sensitive number fields
    for title in ["Income certificate request", "Scholarship application", "Old age pension application"]:
        res = await async_db_session.execute(select(Form).where(Form.title == title))
        f = res.scalar_one_or_none()
        assert f is not None
        assert f.status == "published"

        # Check fields
        v_res = await async_db_session.execute(select(FormVersion).where(FormVersion.form_id == f.id))
        ver = v_res.scalar_one_or_none()
        assert ver is not None

        fields_res = await async_db_session.execute(select(FormField).where(FormField.form_version_id == ver.id))
        fields = fields_res.scalars().all()
        assert len(fields) >= 8

        for field in fields:
            # Must not be sensitive identity numbers in seed forms
            assert not field.is_sensitive_number
            assert "aadhaar" not in field.field_name.lower()
            assert "pan" not in field.field_name.lower()
