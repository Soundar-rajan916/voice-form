import csv
import io
from fastapi import APIRouter, Depends, HTTPException, status, Query, Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from typing import List, Optional

from app.config import settings
from app.db import get_db
from app.models import User, Form, FormVersion, FormField, Submission, SubmissionAnswer
from app.schemas import (
    FormCreate, FormUpdate, FormResponse, FormDetailResponse,
    FormVersionResponse, FormFieldResponse, SubmissionDetailResponse,
    SubmissionAnswerResponse
)
from app.deps import require_admin
from app.services.questions import generate_field_questions
from app.services.extraction import extract_answer
from app.services.submission_title import compute_submission_titles_batch

router = APIRouter(prefix="/admin/forms", tags=["admin-forms"])

@router.get("/health/extraction")
async def extraction_health_check(current_user: User = Depends(require_admin)):
    """Admin-only endpoint to test real LLM extraction health."""
    test_transcript = "My name is Artie Svandararajan."
    res, dur, path = await extract_answer(
        field_name="full_name",
        data_type="String",
        description="full name of the user",
        transcript=test_transcript
    )
    return {
        "status": "healthy" if res.fulfilled else "degraded",
        "configured_llm_model": settings.GROQ_LLM_MODEL,
        "path_taken": path,
        "input_transcript": test_transcript,
        "extracted_value": res.value,
        "fulfilled": res.fulfilled,
        "latency_seconds": dur,
        "follow_up": res.follow_up
    }

@router.post("", response_model=FormDetailResponse, status_code=status.HTTP_201_CREATED)
async def create_form(
    form_in: FormCreate,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    form = Form(
        title=form_in.title,
        description=form_in.description,
        status="draft",
        created_by=current_user.id
    )
    db.add(form)
    await db.flush()

    form_version = FormVersion(
        form_id=form.id,
        version_number=1
    )
    db.add(form_version)
    await db.flush()

    for idx, field_data in enumerate(form_in.fields):
        field = FormField(
            form_version_id=form_version.id,
            field_name=field_data.field_name,
            data_type=field_data.data_type,
            description=field_data.description,
            required=field_data.required,
            position=field_data.position if field_data.position is not None else idx,
            choices=field_data.choices,
            question_en=field_data.question_en,
            question_ta=field_data.question_ta
        )
        db.add(field)

    form_id = form.id
    await db.commit()

    # Re-query form with relationships loaded
    result = await db.execute(
        select(Form)
        .options(
            selectinload(Form.versions).selectinload(FormVersion.fields)
        )
        .where(Form.id == form_id)
        .execution_options(populate_existing=True)
    )
    form_obj = result.scalar_one()
    latest_version = form_obj.versions[-1] if form_obj.versions else None

    return FormDetailResponse(
        id=form_obj.id,
        title=form_obj.title,
        description=form_obj.description,
        status=form_obj.status,
        created_by=form_obj.created_by,
        created_at=form_obj.created_at,
        updated_at=form_obj.updated_at,
        current_version=FormVersionResponse.model_validate(latest_version) if latest_version else None
    )

@router.get("", response_model=List[FormResponse])
async def list_admin_forms(
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Form)
        .options(selectinload(Form.versions).selectinload(FormVersion.fields))
        .order_by(Form.updated_at.desc())
        .execution_options(populate_existing=True)
    )
    forms = result.scalars().all()

    response = []
    for f in forms:
        latest_ver = f.versions[-1] if f.versions else None
        v_num = latest_ver.version_number if latest_ver else 0
        field_count = len(latest_ver.fields) if latest_ver else 0
        response.append(
            FormResponse(
                id=f.id,
                title=f.title,
                description=f.description,
                status=f.status,
                created_by=f.created_by,
                created_at=f.created_at,
                updated_at=f.updated_at,
                latest_version_number=v_num,
                field_count=field_count
            )
        )
    return response

@router.get("/{form_id}", response_model=FormDetailResponse)
async def get_admin_form(
    form_id: int,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Form)
        .options(selectinload(Form.versions).selectinload(FormVersion.fields))
        .where(Form.id == form_id)
        .execution_options(populate_existing=True)
    )
    form = result.scalar_one_or_none()
    if not form:
        raise HTTPException(status_code=404, detail="Form not found")

    latest_version = form.versions[-1] if form.versions else None
    return FormDetailResponse(
        id=form.id,
        title=form.title,
        description=form.description,
        status=form.status,
        created_by=form.created_by,
        created_at=form.created_at,
        updated_at=form.updated_at,
        current_version=FormVersionResponse.model_validate(latest_version) if latest_version else None
    )

@router.put("/{form_id}", response_model=FormDetailResponse)
async def update_form(
    form_id: int,
    form_in: FormUpdate,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Form)
        .options(selectinload(Form.versions).selectinload(FormVersion.fields))
        .where(Form.id == form_id)
        .execution_options(populate_existing=True)
    )
    form = result.scalar_one_or_none()
    if not form:
        raise HTTPException(status_code=404, detail="Form not found")

    if form_in.title is not None:
        form.title = form_in.title
    if form_in.description is not None:
        form.description = form_in.description

    if form_in.fields is not None:
        sub_count_res = await db.execute(
            select(func.count(Submission.id)).where(Submission.form_id == form_id)
        )
        sub_count = sub_count_res.scalar() or 0

        latest_version = form.versions[-1] if form.versions else None

        if form.status == "draft" and sub_count == 0:
            if latest_version:
                for old_field in list(latest_version.fields):
                    await db.delete(old_field)
                await db.flush()
                target_version = latest_version
            else:
                target_version = FormVersion(form_id=form.id, version_number=1)
                db.add(target_version)
                await db.flush()
        else:
            new_v_num = (latest_version.version_number + 1) if latest_version else 1
            target_version = FormVersion(form_id=form.id, version_number=new_v_num)
            db.add(target_version)
            await db.flush()
            form.status = "draft"

        for idx, field_data in enumerate(form_in.fields):
            field = FormField(
                form_version_id=target_version.id,
                field_name=field_data.field_name,
                data_type=field_data.data_type,
                description=field_data.description,
                required=field_data.required,
                position=field_data.position if field_data.position is not None else idx,
                choices=field_data.choices,
                question_en=field_data.question_en,
                question_ta=field_data.question_ta
            )
            db.add(field)

    await db.commit()

    res = await db.execute(
        select(Form)
        .options(selectinload(Form.versions).selectinload(FormVersion.fields))
        .where(Form.id == form_id)
        .execution_options(populate_existing=True)
    )
    updated_form = res.scalar_one()
    latest_ver = updated_form.versions[-1] if updated_form.versions else None

    return FormDetailResponse(
        id=updated_form.id,
        title=updated_form.title,
        description=updated_form.description,
        status=updated_form.status,
        created_by=updated_form.created_by,
        created_at=updated_form.created_at,
        updated_at=updated_form.updated_at,
        current_version=FormVersionResponse.model_validate(latest_ver) if latest_ver else None
    )

@router.post("/{form_id}/publish", response_model=FormDetailResponse)
async def publish_form(
    form_id: int,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Form)
        .options(selectinload(Form.versions).selectinload(FormVersion.fields))
        .where(Form.id == form_id)
        .execution_options(populate_existing=True)
    )
    form = result.scalar_one_or_none()
    if not form:
        raise HTTPException(status_code=404, detail="Form not found")

    if not form.versions:
        raise HTTPException(status_code=400, detail="Form has no versions/fields to publish")

    latest_version = form.versions[-1]

    for field in latest_version.fields:
        if not field.question_en or not field.question_ta:
            q_en, q_ta = await generate_field_questions(
                field_name=field.field_name,
                description=field.description,
                data_type=field.data_type,
                choices=field.choices
            )
            if not field.question_en:
                field.question_en = q_en
            if not field.question_ta:
                field.question_ta = q_ta

    form.status = "published"
    await db.commit()

    res = await db.execute(
        select(Form)
        .options(selectinload(Form.versions).selectinload(FormVersion.fields))
        .where(Form.id == form_id)
        .execution_options(populate_existing=True)
    )
    pub_form = res.scalar_one()

    return FormDetailResponse(
        id=pub_form.id,
        title=pub_form.title,
        description=pub_form.description,
        status=pub_form.status,
        created_by=pub_form.created_by,
        created_at=pub_form.created_at,
        updated_at=pub_form.updated_at,
        current_version=FormVersionResponse.model_validate(pub_form.versions[-1])
    )

@router.post("/{form_id}/archive", response_model=FormDetailResponse)
async def archive_form(
    form_id: int,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Form)
        .options(selectinload(Form.versions).selectinload(FormVersion.fields))
        .where(Form.id == form_id)
        .execution_options(populate_existing=True)
    )
    form = result.scalar_one_or_none()
    if not form:
        raise HTTPException(status_code=404, detail="Form not found")

    form.status = "archived"
    await db.commit()

    res = await db.execute(
        select(Form)
        .options(selectinload(Form.versions).selectinload(FormVersion.fields))
        .where(Form.id == form_id)
        .execution_options(populate_existing=True)
    )
    arch_form = res.scalar_one()

    latest_version = arch_form.versions[-1] if arch_form.versions else None
    return FormDetailResponse(
        id=arch_form.id,
        title=arch_form.title,
        description=arch_form.description,
        status=arch_form.status,
        created_by=arch_form.created_by,
        created_at=arch_form.created_at,
        updated_at=arch_form.updated_at,
        current_version=FormVersionResponse.model_validate(latest_version) if latest_version else None
    )

@router.get("/{form_id}/submissions", response_model=List[SubmissionDetailResponse])
async def get_admin_form_submissions(
    form_id: int,
    version_id: Optional[int] = Query(None, description="Filter by version ID"),
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    query = (
        select(Submission)
        .options(
            selectinload(Submission.form),
            selectinload(Submission.version).selectinload(FormVersion.fields),
            selectinload(Submission.answers),
            selectinload(Submission.user)
        )
        .where(Submission.form_id == form_id)
    )

    if version_id:
        query = query.where(Submission.form_version_id == version_id)

    query = query.order_by(Submission.started_at.desc())

    res = await db.execute(query)
    submissions = res.scalars().all()
    title_map = await compute_submission_titles_batch(db, submissions)

    result = []
    for s in submissions:
        ver_fields = s.version.fields if s.version else []
        sub_title = title_map.get(s.id, f"submission-{s.id}")
        result.append(
            SubmissionDetailResponse(
                id=s.id,
                form_id=s.form_id,
                form_version_id=s.form_version_id,
                version_number=s.version.version_number if s.version else 1,
                user_id=s.user_id,
                user_email=s.user.email if s.user else "Unknown",
                status=s.status,
                started_at=s.started_at,
                completed_at=s.completed_at,
                submission_title=sub_title,
                submission_name=sub_title,
                answers=[SubmissionAnswerResponse.model_validate(a) for a in s.answers],
                fields=[FormFieldResponse.model_validate(f) for f in ver_fields]
            )
        )

    return result

@router.get("/{form_id}/submissions.csv")
async def export_submissions_csv(
    form_id: int,
    version_id: Optional[int] = Query(None),
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    form_res = await db.execute(select(Form).where(Form.id == form_id))
    form = form_res.scalar_one_or_none()
    if not form:
        raise HTTPException(status_code=404, detail="Form not found")

    query = (
        select(Submission)
        .options(
            selectinload(Submission.form),
            selectinload(Submission.version).selectinload(FormVersion.fields),
            selectinload(Submission.answers),
            selectinload(Submission.user)
        )
        .where(Submission.form_id == form_id)
    )
    if version_id:
        query = query.where(Submission.form_version_id == version_id)

    res = await db.execute(query)
    submissions = res.scalars().all()
    title_map = await compute_submission_titles_batch(db, submissions)

    output = io.StringIO()
    writer = csv.writer(output)

    writer.writerow([
        "Submission Title", "Submission ID", "User Email", "Version Number", "Status",
        "Started At", "Completed At", "Field Name", "Cleaned Value", "Raw Transcript"
    ])

    for s in submissions:
        v_num = s.version.version_number if s.version else 1
        answers_by_field = {a.field_id: a for a in s.answers}
        fields = s.version.fields if s.version else []
        sub_title = title_map.get(s.id, f"submission-{s.id}")
        for f in fields:
            ans = answers_by_field.get(f.id)
            val = ans.value if ans else ""
            raw = ans.raw_transcript if ans else ""
            writer.writerow([
                sub_title, s.id, s.user.email if s.user else "", v_num, s.status,
                s.started_at.isoformat() if s.started_at else "",
                s.completed_at.isoformat() if s.completed_at else "",
                f.field_name, val, raw
            ])

    output.seek(0)
    filename = f"form_{form_id}_submissions.csv"
    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )
