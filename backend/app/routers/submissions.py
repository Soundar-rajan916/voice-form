import asyncio
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, status, Query, Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from typing import List, Optional

from app.config import settings
from app.db import get_db
from app.models import User, Form, FormVersion, FormField, Submission, SubmissionAnswer
from app.schemas import (
    SubmissionDetailResponse, SubmissionAnswerCreate,
    SubmissionAnswerResponse, FormFieldResponse
)
from app.deps import require_user, check_submission_access
from app.services.submission_title import compute_submission_title, compute_submission_titles_batch
from app.services.crypto import encrypt_field_value, decrypt_field_value, mask_field_value
from app.services.audit import record_audit_event
from app.services.email_service import dispatch_submission_email

router = APIRouter(tags=["user-submissions"])

def _format_answers_for_response(answers: List[SubmissionAnswer], fields: List[FormField]) -> List[SubmissionAnswerResponse]:
    """Decodes/masks answers according to sensitive number flags."""
    field_map = {f.id: f for f in fields}
    result = []
    for a in answers:
        f = field_map.get(a.field_id)
        val = a.value
        raw_tr = a.raw_transcript
        if f and getattr(f, "is_sensitive_number", False) and val:
            # Decrypt stored value and mask except last 4 digits
            plain = decrypt_field_value(val)
            val = mask_field_value(plain)
            raw_tr = None # Sensitive number never stored in transcript

        result.append(
            SubmissionAnswerResponse(
                id=a.id,
                submission_id=a.submission_id,
                field_id=a.field_id,
                value=val,
                raw_transcript=raw_tr,
                language=a.language,
                source=a.source,
                evidence=a.evidence,
                source_confidence=a.source_confidence,
                updated_at=a.updated_at
            )
        )
    return result

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

    channel = "online"
    kiosk_id = None
    assisted_by = None
    consent_at = None
    consent_noted_by = None

    if current_user.role == "kiosk":
        channel = "self_service"
        kiosk_id = current_user.id
        consent_at = datetime.utcnow()
        consent_noted_by = "citizen"
    elif current_user.role == "operator":
        channel = "assisted"
        assisted_by = current_user.id
        consent_at = datetime.utcnow()
        consent_noted_by = current_user.email

    submission = Submission(
        form_id=form.id,
        form_version_id=latest_version.id,
        user_id=current_user.id,
        channel=channel,
        kiosk_id=kiosk_id,
        assisted_by=assisted_by,
        consent_at=consent_at,
        consent_noted_by=consent_noted_by,
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
        reference_number=sub.reference_number,
        channel=sub.channel,
        assisted_by=sub.assisted_by,
        kiosk_id=sub.kiosk_id,
        consent_at=sub.consent_at,
        consent_noted_by=sub.consent_noted_by,
        language_chosen=sub.language_chosen,
        retention_expires_at=sub.retention_expires_at,
        print_count=sub.print_count or 0,
        answers=[],
        fields=[FormFieldResponse.model_validate(f) for f in sub.version.fields]
    )

@router.get("/submissions", response_model=List[SubmissionDetailResponse])
async def list_user_submissions(
    current_user: User = Depends(require_user),
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
    )

    if current_user.role == "admin":
        pass # admin sees all
    elif current_user.role == "operator":
        # Operators see applications they assisted
        query = query.where((Submission.assisted_by == current_user.id) | (Submission.user_id == current_user.id))
    else:
        query = query.where(Submission.user_id == current_user.id)

    query = query.order_by(Submission.started_at.desc())

    res = await db.execute(query)
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

        formatted_answers = _format_answers_for_response(s.answers, ver_fields)

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
                reference_number=s.reference_number,
                channel=s.channel,
                assisted_by=s.assisted_by,
                kiosk_id=s.kiosk_id,
                consent_at=s.consent_at,
                consent_noted_by=s.consent_noted_by,
                language_chosen=s.language_chosen,
                retention_expires_at=s.retention_expires_at,
                print_count=s.print_count or 0,
                answers=formatted_answers,
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
    if not sub:
        raise HTTPException(status_code=404, detail="Submission not found")

    check_submission_access(sub, current_user)

    if current_user.role in ("admin", "operator"):
        await record_audit_event(
            db,
            action="view_submission",
            actor_id=current_user.id,
            actor_role=current_user.role,
            target_type="submission",
            target_id=str(sub.id),
            details={"reference_number": sub.reference_number}
        )

    sub_title = await compute_submission_title(db, sub)
    ver_fields = sub.version.fields if sub.version else []
    ans_map = {a.field_id: a.value for a in sub.answers if a.value}
    req_fields = [f for f in ver_fields if f.required]
    all_ans = len(req_fields) > 0 and all(f.id in ans_map and str(ans_map[f.id]).strip() != "" for f in req_fields)
    can_edit = (sub.status == "in_progress")

    formatted_answers = _format_answers_for_response(sub.answers, ver_fields)

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
        reference_number=sub.reference_number,
        channel=sub.channel,
        assisted_by=sub.assisted_by,
        kiosk_id=sub.kiosk_id,
        consent_at=sub.consent_at,
        consent_noted_by=sub.consent_noted_by,
        language_chosen=sub.language_chosen,
        retention_expires_at=sub.retention_expires_at,
        print_count=sub.print_count or 0,
        answers=formatted_answers,
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
    if not sub:
        raise HTTPException(status_code=404, detail="Submission not found")

    check_submission_access(sub, current_user)

    if sub.status in ["submitted", "completed"] and current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Submitted forms cannot be deleted"
        )

    await db.delete(sub)
    await db.commit()

    await record_audit_event(
        db,
        action="delete_submission",
        actor_id=current_user.id,
        actor_role=current_user.role,
        target_type="submission",
        target_id=str(submission_id)
    )
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
    if not sub:
        raise HTTPException(status_code=404, detail="Submission not found")

    check_submission_access(sub, current_user)

    ver_fields = sub.version.fields if sub.version else []
    field_by_id = {f.id: f for f in ver_fields}

    # Upsert answers if provided
    if answers_in:
        existing_answers = {a.field_id: a for a in sub.answers}
        for ans in answers_in:
            target_field = field_by_id.get(ans.field_id)
            is_sens = getattr(target_field, "is_sensitive_number", False) if target_field else False

            # Encrypt sensitive number fields at rest
            final_val = ans.value
            final_raw = ans.raw_transcript
            if is_sens and final_val:
                final_val = encrypt_field_value(final_val)
                final_raw = None # Never log or retain transcript of sensitive numbers

            if ans.field_id in existing_answers:
                existing_ans = existing_answers[ans.field_id]
                existing_ans.value = final_val
                if final_raw is not None:
                    existing_ans.raw_transcript = final_raw
                if ans.language is not None:
                    existing_ans.language = ans.language
                existing_ans.updated_at = datetime.utcnow()
            else:
                new_ans = SubmissionAnswer(
                    submission_id=sub.id,
                    field_id=ans.field_id,
                    value=final_val,
                    raw_transcript=final_raw,
                    language=ans.language,
                    updated_at=datetime.utcnow()
                )
                db.add(new_ans)
        await db.commit()
        await db.refresh(sub)

    # Validate submit: check missing required fields
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

        # Set retention expiration date
        if not sub.retention_expires_at:
            sub.retention_expires_at = now + timedelta(days=settings.RETENTION_DAYS)

        await db.commit()

        # Dispatch email with submitted form details to user's Gmail in background
        asyncio.create_task(dispatch_submission_email(sub.id))

        await record_audit_event(
            db,
            action="submit_application",
            actor_id=current_user.id,
            actor_role=current_user.role,
            target_type="submission",
            target_id=str(sub.id),
            details={
                "retention_expires_at": sub.retention_expires_at.isoformat()
            }
        )

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
    formatted_answers = _format_answers_for_response(updated_sub.answers, ver_fields)

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
        reference_number=updated_sub.reference_number,
        channel=updated_sub.channel,
        assisted_by=updated_sub.assisted_by,
        kiosk_id=updated_sub.kiosk_id,
        consent_at=updated_sub.consent_at,
        consent_noted_by=updated_sub.consent_noted_by,
        language_chosen=updated_sub.language_chosen,
        retention_expires_at=updated_sub.retention_expires_at,
        print_count=updated_sub.print_count or 0,
        answers=formatted_answers,
        fields=[FormFieldResponse.model_validate(f) for f in ver_fields]
    )

