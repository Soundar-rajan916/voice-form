import pytest
from sqlalchemy import select
from app.config import settings
from app.models import Form, FormVersion, FormField
from app.services.seed import seed_sample_forms, SAMPLE_FORMS

@pytest.mark.asyncio
async def test_seed_sample_forms_creates_three_forms(async_db_session):
    await seed_sample_forms(async_db_session)

    res = await async_db_session.execute(select(Form).where(Form.status == "published"))
    published_forms = res.scalars().all()

    form_titles = [f.title for f in published_forms]
    for sf in SAMPLE_FORMS:
        assert sf["title"] in form_titles

    # Test idempotency (running again should not duplicate)
    await seed_sample_forms(async_db_session)

    res2 = await async_db_session.execute(select(Form).where(Form.status == "published"))
    published_forms_2 = res2.scalars().all()
    assert len(published_forms_2) == len(SAMPLE_FORMS)

@pytest.mark.asyncio
async def test_seed_form_fields_and_no_id_fields(async_db_session):
    await seed_sample_forms(async_db_session)

    res = await async_db_session.execute(select(Form).where(Form.title == "Income certificate request"))
    form = res.scalar_one()

    res_ver = await async_db_session.execute(select(FormVersion).where(FormVersion.form_id == form.id))
    version = res_ver.scalar_one()

    res_fields = await async_db_session.execute(select(FormField).where(FormField.form_version_id == version.id))
    fields = res_fields.scalars().all()

    field_names = [f.field_name for f in fields]

    # Verify income certificate request fields
    assert "applicant_name" in field_names
    assert "father_or_guardian_name" in field_names
    assert "date_of_birth" in field_names
    assert "mobile_number" in field_names
    assert "address" in field_names
    assert "district" in field_names
    assert "taluk" in field_names
    assert "purpose_of_certificate" in field_names
    assert "occupation" in field_names
    assert "annual_family_income" in field_names
    assert "family_members_count" in field_names

    # Ensure no identity number fields (no aadhaar, ssn, pan, etc)
    for fn in field_names:
        assert "aadhaar" not in fn.lower()
        assert "pan" not in fn.lower()
        assert "voter" not in fn.lower()
        assert "ration" not in fn.lower()

@pytest.mark.asyncio
async def test_app_name_config():
    assert settings.APP_NAME == "Citizen Desk"
    assert settings.OFFICE_NAME == "Citizen Service Centre"
    assert settings.SEED_SAMPLE_FORMS is True
