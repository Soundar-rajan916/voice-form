from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query, Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from sqlalchemy.orm import selectinload

from app.db import get_db
from app.models import User, Form, FormVersion, Submission, KioskHelpRequest
from app.schemas import (
    KioskSessionCreate, KioskSessionResponse,
    FormResponse,
    KioskHelpRequestCreate, KioskHelpRequestResponse,
    SubmissionResponse
)
from app.deps import require_kiosk, require_admin, get_current_user, get_current_user_optional
from app.security import create_kiosk_scoped_token
from app.services.audit import record_audit_event
from app.services.submission_title import compute_submission_titles_batch

router = APIRouter(tags=["kiosk-desk"])

# --- KIOSK ENDPOINTS ---

@router.get("/kiosk/forms", response_model=List[FormResponse])
async def list_kiosk_services(
    db: AsyncSession = Depends(get_db)
):
    """Returns published citizen services available for kiosk selection."""
    stmt = (
        select(Form)
        .options(selectinload(Form.versions).selectinload(FormVersion.fields))
        .where(Form.status == "published")
        .order_by(Form.title.asc())
    )
    res = await db.execute(stmt)
    forms = res.scalars().all()

    response = []
    for f in forms:
        latest_ver = f.versions[-1] if f.versions else None
        v_num = latest_ver.version_number if latest_ver else 1
        f_count = len(latest_ver.fields) if latest_ver else 0
        response.append(
            FormResponse(
                id=f.id,
                title=f.title,
                description=f.description,
                status=f.status,
                allow_document_upload=f.allow_document_upload,
                created_by=f.created_by,
                created_at=f.created_at,
                updated_at=f.updated_at,
                latest_version_number=v_num,
                field_count=f_count
            )
        )
    response_obj = Response(content=None, media_type="application/json")
    response_obj.headers["Cache-Control"] = "no-store, no-cache, must-revalidate"
    return response

@router.post("/kiosk/sessions", response_model=KioskSessionResponse, status_code=status.HTTP_201_CREATED)
async def create_kiosk_session(
    session_in: KioskSessionCreate,
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db)
):
    """
    Kiosk device initiates a new self-service session.
    Generates a 20-minute scoped token allowing access ONLY to this specific submission.
    """
    if current_user and current_user.role in ("kiosk", "admin"):
        kiosk_device = current_user
    else:
        res_kiosk = await db.execute(select(User).where(User.role == "kiosk", User.is_active == True))
        kiosk_device = res_kiosk.scalars().first()
        if not kiosk_device:
            from app.security import hash_password
            kiosk_device = User(
                email="kiosk_terminal_1@desk.local",
                hashed_password=hash_password("kiosk_pass_secure_123"),
                role="kiosk",
                is_active=True,
                device_name="Kiosk Terminal 01"
            )
            db.add(kiosk_device)
            await db.flush()

    res = await db.execute(
        select(Form)
        .options(selectinload(Form.versions).selectinload(FormVersion.fields))
        .where(Form.id == session_in.form_id, Form.status == "published")
    )
    form = res.scalar_one_or_none()
    if not form or not form.versions:
        raise HTTPException(status_code=404, detail="Selected service form not found or not published")

    latest_ver = form.versions[-1]

    sub = Submission(
        form_id=form.id,
        form_version_id=latest_ver.id,
        user_id=kiosk_device.id,
        channel="self_service",
        kiosk_id=kiosk_device.id,
        consent_at=datetime.utcnow() if session_in.consent_agreed else None,
        consent_noted_by="citizen",
        language_chosen=session_in.language,
        status="in_progress"
    )
    db.add(sub)
    await db.commit()
    await db.refresh(sub)

    scoped_token = create_kiosk_scoped_token(kiosk_device.id, sub.id, expires_minutes=20)

    await record_audit_event(
        db,
        action="kiosk_session_start",
        actor_id=kiosk_device.id,
        actor_role="kiosk",
        target_type="submission",
        target_id=str(sub.id),
        details={"form_title": form.title, "language": session_in.language, "kiosk_device": getattr(kiosk_device, 'device_name', None)}
    )

    return KioskSessionResponse(
        submission_id=sub.id,
        scoped_token=scoped_token,
        form_title=form.title,
        language=session_in.language,
        expires_in_minutes=20
    )

@router.post("/kiosk/help", response_model=KioskHelpRequestResponse)
async def request_kiosk_help(
    help_in: Optional[KioskHelpRequestCreate] = None,
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db)
):
    """Marks the kiosk as needing operator assistance."""
    kiosk_id = current_user.id if current_user else None
    kiosk_name = (help_in and help_in.kiosk_name) or (current_user and (current_user.device_name or current_user.username)) or "Kiosk Terminal"
    req = KioskHelpRequest(
        kiosk_id=kiosk_id,
        kiosk_name=kiosk_name,
        status="pending"
    )
    db.add(req)
    await db.commit()
    await db.refresh(req)

    await record_audit_event(
        db,
        action="kiosk_help_called",
        actor_id=kiosk_id,
        actor_role=current_user.role if current_user else "kiosk",
        target_type="kiosk_help",
        target_id=str(req.id),
        details={"kiosk_name": kiosk_name}
    )
    return req

# --- KIOSK ASSISTANCE QUEUE (ADMIN) ---

@router.get("/admin/kiosk-help", response_model=List[KioskHelpRequestResponse])
async def list_pending_kiosk_help_requests(
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """Admin polls this endpoint to see kiosks requesting assistance."""
    stmt = (
        select(KioskHelpRequest)
        .where(KioskHelpRequest.status == "pending")
        .order_by(desc(KioskHelpRequest.created_at))
    )
    res = await db.execute(stmt)
    return res.scalars().all()

@router.post("/admin/kiosk-help/{request_id}/resolve", response_model=KioskHelpRequestResponse)
async def resolve_kiosk_help_request(
    request_id: int,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """Admin dismisses or marks a kiosk help request as resolved."""
    res = await db.execute(select(KioskHelpRequest).where(KioskHelpRequest.id == request_id))
    req = res.scalar_one_or_none()
    if not req:
        raise HTTPException(status_code=404, detail="Help request not found")

    req.status = "resolved"
    req.resolved_at = datetime.utcnow()
    req.resolved_by = current_user.id
    await db.commit()
    await db.refresh(req)

    await record_audit_event(
        db,
        action="kiosk_help_resolved",
        actor_id=current_user.id,
        actor_role=current_user.role,
        target_type="kiosk_help",
        target_id=str(req.id),
        details={"kiosk_name": req.kiosk_name, "resolved_by": current_user.email}
    )
    return req

