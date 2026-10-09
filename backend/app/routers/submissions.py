from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from typing import List, Optional

from app.db import get_db
from app.models import User, Form, FormVersion, FormField, Submission, SubmissionAnswer
from app.schemas import (
    SubmissionResponse, SubmissionDetailResponse, SubmissionAnswerCreate,
    SubmissionAnswerResponse, FormFieldResponse
)
from app.deps import require_user
from app.services.submission_title import compute_submission_title, compute_submission_titles_batch

router = APIRouter(tags=["user-submissions"])

@router.post("/forms/{form_id}/submissions", response_model=SubmissionDetailResponse, status_code=status.HTTP_201_CREATED)
async def start_submission(
    form_id: int,
    current_user: User = Depends(require_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Form)
        .options(selectinload(Form.versions).selectinload(FormVersion.fields))
        .where(Form.id == form_id, Form.status == "published")
    )
    form = result.scalar_one_or_none()
    if not form or not form.versions:
        raise HTTPException(status_code=404, detail="Form not found or not published")

    latest_version = form.versions[-1]

    submission = Submission(
        form_id=form.id,
        form_version_id=latest_version.id,
        user_id=current_user.id,
        status="in_progress",
        started_at=datetime.utcnow()
    )
    db.add(submission)
    await db.commit()

    # Re-query
    res = await db.execute(
        select(Submission)
        .options(
            selectinload(Submission.form),
            selectinload(Submission.version).selectinload(FormVersion.fields),
            selectinload(Submission.answers),
            selectinload(Submission.user)
        )
        .where(Submission.id == submission.id)
    )
    sub = res.scalar_one()
    title_str = await compute_submission_title(db, sub, form.title)

    return SubmissionDetailResponse(
        id=sub.id,
        form_id=sub.form_id,
        form_version_id=sub.form_version_id,
        version_number=sub.version.version_number,
        user_id=sub.user_id,
        user_email=sub.user.email,
        status=sub.status,
        started_at=sub.started_at,
        completed_at=sub.completed_at,
        submitted_at=sub.submitted_at,
        submission_title=title_str,
        submission_name=title_str,
        all_answered=False,
        can_edit=True,
        answers=[],
        fields=[FormFieldResponse.model_validate(f) for f in sub.version.fields]
    )

@router.get("/submissions", response_model=List[SubmissionDetailResponse])
async def list_user_submissions(
    current_user: User = Depends(require_user),
    db: AsyncSession = Depends(get_db)
):
    res = await db.execute(
        select(Submission)
        .options(
            selectinload(Submission.form),
            selectinload(Submission.version).selectinload(FormVersion.fields),
            selectinload(Submission.answers),
            selectinload(Submission.user)
        )
        .where(Submission.user_id == current_user.id)
        .order_by(Submission.started_at.desc())
    )
    submissions = res.scalars().all()
    title_map = await compute_submission_titles_batch(db, submissions)

    result = []
    for s in submissions:
        ver_fields = s.version.fields if s.version else []
        sub_title = title_map.get(s.id, f"submission-{s.id}")
        ans_map = {a.field_id: a.value for a in s.answers if a.value}
        req_fields = [f for f in ver_fields if f.required]
        all_ans = len(req_fields) > 0 and all(f.id in ans_map and str(ans_map[f.id]).strip() != "" for f in req_fields)
        can_edit = (s.status == "in_progress")

        result.append(
            SubmissionDetailResponse(
                id=s.id,
                form_id=s.form_id,
                form_version_id=s.form_version_id,
                version_number=s.version.version_number if s.version else 1,
                user_id=s.user_id,
                user_email=s.user.email if s.user else "",
                status=s.status,
                started_at=s.started_at,
                completed_at=s.completed_at,
                submitted_at=s.submitted_at,
                submission_title=sub_title,
                submission_name=sub_title,
                all_answered=all_ans,
                can_edit=can_edit,
                answers=[SubmissionAnswerResponse.model_validate(a) for a in s.answers],
                fields=[FormFieldResponse.model_validate(f) for f in ver_fields]
            )
        )
    return result

@router.get("/submissions/{submission_id}", response_model=SubmissionDetailResponse)
async def get_user_submission(
    submission_id: int,
    current_user: User = Depends(require_user),
    db: AsyncSession = Depends(get_db)
):
    res = await db.execute(
        select(Submission)
        .options(
            selectinload(Submission.form),
            selectinload(Submission.version).selectinload(FormVersion.fields),
            selectinload(Submission.answers),
            selectinload(Submission.user)
        )
        .where(Submission.id == submission_id)
    )
    sub = res.scalar_one_or_none()
    
    # CRITICAL: Return 404 (not 403) for other users' submissions!
    if not sub or (sub.user_id != current_user.id and current_user.role != "admin"):
        raise HTTPException(status_code=404, detail="Submission not found")

    sub_title = await compute_submission_title(db, sub)
    ver_fields = sub.version.fields if sub.version else []
    ans_map = {a.field_id: a.value for a in sub.answers if a.value}
    req_fields = [f for f in ver_fields if f.required]
    all_ans = len(req_fields) > 0 and all(f.id in ans_map and str(ans_map[f.id]).strip() != "" for f in req_fields)
    can_edit = (sub.status == "in_progress")

    return SubmissionDetailResponse(
        id=sub.id,
        form_id=sub.form_id,
        form_version_id=sub.form_version_id,
        version_number=sub.version.version_number if sub.version else 1,
        user_id=sub.user_id,
        user_email=sub.user.email if sub.user else "",
        status=sub.status,
        started_at=sub.started_at,
        completed_at=sub.completed_at,
        submitted_at=sub.submitted_at,
        submission_title=sub_title,
        submission_name=sub_title,
        all_answered=all_ans,
        can_edit=can_edit,
        answers=[SubmissionAnswerResponse.model_validate(a) for a in sub.answers],
        fields=[FormFieldResponse.model_validate(f) for f in ver_fields]
    )

@router.delete("/submissions/{submission_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user_submission(
    submission_id: int,
    current_user: User = Depends(require_user),
    db: AsyncSession = Depends(get_db)
):
    res = await db.execute(select(Submission).where(Submission.id == submission_id))
    sub = res.scalar_one_or_none()

    # CRITICAL: Return 404 (not 403) for other users' submissions!
    if not sub or (sub.user_id != current_user.id and current_user.role != "admin"):
        raise HTTPException(status_code=404, detail="Submission not found")

    if sub.status in ["submitted", "completed"] and current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Submitted forms cannot be deleted"
        )

    await db.delete(sub)
    await db.commit()
    return None

@router.post("/submissions/{submission_id}/submit", response_model=SubmissionDetailResponse)
@router.post("/submissions/{submission_id}/complete", response_model=SubmissionDetailResponse)
async def complete_submission(
    submission_id: int,
    answers_in: Optional[List[SubmissionAnswerCreate]] = None,
    current_user: User = Depends(require_user),
    db: AsyncSession = Depends(get_db)
):
    res = await db.execute(
        select(Submission)
        .options(
            selectinload(Submission.form),
            selectinload(Submission.version).selectinload(FormVersion.fields),
            selectinload(Submission.answers),
            selectinload(Submission.user)
        )
        .where(Submission.id == submission_id)
    )
    sub = res.scalar_one_or_none()
    if not sub or (sub.user_id != current_user.id and current_user.role != "admin"):
        raise HTTPException(status_code=404, detail="Submission not found")

    # Upsert answers if provided
    if answers_in:
        existing_answers = {a.field_id: a for a in sub.answers}
        for ans in answers_in:
            if ans.field_id in existing_answers:
                existing_ans = existing_answers[ans.field_id]
                existing_ans.value = ans.value
                if ans.raw_transcript is not None:
                    existing_ans.raw_transcript = ans.raw_transcript
                if ans.language is not None:
                    existing_ans.language = ans.language
                existing_ans.updated_at = datetime.utcnow()
            else:
                new_ans = SubmissionAnswer(
                    submission_id=sub.id,
                    field_id=ans.field_id,
                    value=ans.value,
                    raw_transcript=ans.raw_transcript,
                    language=ans.language,
                    updated_at=datetime.utcnow()
                )
                db.add(new_ans)
        await db.commit()
        await db.refresh(sub)

    # Validate submit: check missing required fields
    ver_fields = sub.version.fields if sub.version else []
    answers_map = {a.field_id: a.value for a in sub.answers if a.value}
    missing_fields = [
        f.field_name.replace("_", " ") for f in ver_fields
        if f.required and (f.id not in answers_map or not str(answers_map[f.id]).strip())
    ]
    if missing_fields and sub.status == "in_progress":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot submit form: missing required fields: {', '.join(missing_fields)}"
        )

    # Idempotent Submit
    if sub.status == "in_progress":
        sub.status = "submitted"
        now = datetime.utcnow()
        sub.submitted_at = now
        sub.completed_at = now
        await db.commit()

    # Re-query
    res = await db.execute(
        select(Submission)
        .options(
            selectinload(Submission.form),
            selectinload(Submission.version).selectinload(FormVersion.fields),
            selectinload(Submission.answers),
            selectinload(Submission.user)
        )
        .where(Submission.id == submission_id)
    )
    updated_sub = res.scalar_one()
    sub_title = await compute_submission_title(db, updated_sub)
    ver_fields = updated_sub.version.fields if updated_sub.version else []
    ans_map = {a.field_id: a.value for a in updated_sub.answers if a.value}
    req_fields = [f for f in ver_fields if f.required]
    all_ans = len(req_fields) > 0 and all(f.id in ans_map and str(ans_map[f.id]).strip() != "" for f in req_fields)
    can_edit = (updated_sub.status == "in_progress")

    return SubmissionDetailResponse(
        id=updated_sub.id,
        form_id=updated_sub.form_id,
        form_version_id=updated_sub.form_version_id,
        version_number=updated_sub.version.version_number if updated_sub.version else 1,
        user_id=updated_sub.user_id,
        user_email=updated_sub.user.email if updated_sub.user else "",
        status=updated_sub.status,
        started_at=updated_sub.started_at,
        completed_at=updated_sub.completed_at,
        submitted_at=updated_sub.submitted_at,
        submission_title=sub_title,
        submission_name=sub_title,
        all_answered=all_ans,
        can_edit=can_edit,
        answers=[SubmissionAnswerResponse.model_validate(a) for a in updated_sub.answers],
        fields=[FormFieldResponse.model_validate(f) for f in ver_fields]
    )
