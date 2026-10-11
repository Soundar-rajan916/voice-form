import asyncio
import io
import logging
import zipfile
from datetime import datetime, timedelta
from typing import Dict, List

import pypdf
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.config import settings
from app import models, schemas
from app.db import get_db
from app.deps import get_current_user
from app.services.document_extractor import extract_proposals_from_document
from app.services.document_parser import parse_pdf_document, parse_docx_document, parse_image_document
from app.services.session import session_manager
from app.deps import check_submission_access
from app.services.audit import record_audit_event

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/submissions", tags=["documents"])

# In-memory rate limiting map: user_id -> List[datetime]
_user_upload_history: Dict[int, List[datetime]] = {}

def _check_rate_limit(user_id: int):
    now = datetime.utcnow()
    cutoff = now - timedelta(hours=1)
    history = _user_upload_history.get(user_id, [])
    # Filter out entries older than 1 hour
    history = [t for t in history if t > cutoff]
    if len(history) >= settings.UPLOADS_PER_HOUR:
        raise HTTPException(
            status_code=Status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Upload limit of {settings.UPLOADS_PER_HOUR} documents per hour reached. Please try again later."
        )
    history.append(now)
    _user_upload_history[user_id] = history


@router.post("/{submission_id}/documents", response_model=schemas.DocumentUploadResponse)
async def upload_document_for_submission(
    submission_id: int,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Upload a PDF or DOCX document to extract field proposals for an in-progress submission.
    Processes pages in-memory using Text Layer and Groq Vision AI model.
    """
    _check_rate_limit(current_user.id)

    # 1. Fetch submission, form, version, fields
    result = await db.execute(
        select(models.Submission).where(models.Submission.id == submission_id)
    )
    submission = result.scalars().first()

    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found.")

    check_submission_access(submission, current_user)

    if submission.status != "in_progress":
        raise HTTPException(status_code=400, detail="Document upload is only allowed for in-progress submissions.")

    form_res = await db.execute(
        select(models.Form).where(models.Form.id == submission.form_id)
    )
    form = form_res.scalars().first()
    if not form or not form.allow_document_upload:
        raise HTTPException(status_code=400, detail="Document upload is disabled for this form.")

    version_res = await db.execute(
        select(models.FormVersion).where(models.FormVersion.id == submission.form_version_id)
    )
    version = version_res.scalars().first()
    fields_res = await db.execute(
        select(models.FormField)
        .where(models.FormField.form_version_id == submission.form_version_id)
        .order_by(models.FormField.position)
    )
    all_fields = fields_res.scalars().all()
    # Sensitive number fields have document and voice extraction strictly disabled
    fields = [f for f in all_fields if not getattr(f, "is_sensitive_number", False)]

    # 2. File format & extension validation
    filename = file.filename or "document.pdf"
    ext = filename.split(".")[-1].lower()
    allowed_exts = ["pdf", "docx", "jpg", "jpeg", "png", "webp"]
    if ext not in allowed_exts:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file format. Accepted formats: {', '.join(allowed_exts)}."
        )

    # Read bytes into memory
    content = await file.read()
    file_size_mb = len(content) / (1024 * 1024)
    if file_size_mb > settings.MAX_UPLOAD_MB:
        raise HTTPException(
            status_code=413,
            detail=f"File size exceeds maximum allowed limit of {settings.MAX_UPLOAD_MB} MB."
        )

    # 3. Magic Bytes & Security Checks
    if ext == "pdf":
        if not content.startswith(b"%PDF-"):
            raise HTTPException(status_code=400, detail="Invalid PDF file header.")
        try:
            reader = pypdf.PdfReader(io.BytesIO(content))
            if reader.is_encrypted:
                raise HTTPException(status_code=400, detail="Encrypted or password-protected PDFs are not supported.")
            if len(reader.pages) > settings.MAX_PDF_PAGES:
                raise HTTPException(status_code=400, detail=f"PDF page count exceeds limit of {settings.MAX_PDF_PAGES} pages.")
        except Exception as e:
            if isinstance(e, HTTPException):
                raise e
            raise HTTPException(status_code=400, detail=f"Corrupted PDF file: {e}")

    elif ext == "docx":
        if not content.startswith(b"PK\x03\x04"):
            raise HTTPException(status_code=400, detail="Invalid DOCX package header.")
        try:
            zf = zipfile.ZipFile(io.BytesIO(content))
            uncompressed_size = sum(f.file_size for f in zf.infolist())
            compressed_size = len(content)
            if compressed_size > 0 and (uncompressed_size / compressed_size) > 20.0:
                raise HTTPException(status_code=400, detail="Document expansion ratio too high (Zip Bomb protection).")
            # Macro check
            for item in zf.namelist():
                if item.endswith(".bin") or "vbaProject" in item:
                    raise HTTPException(status_code=400, detail="Macro-enabled (.docm) files are not allowed.")
        except Exception as e:
            if isinstance(e, HTTPException):
                raise e
            raise HTTPException(status_code=400, detail=f"Corrupted DOCX document: {e}")

    elif ext in ["jpg", "jpeg"]:
        if not content.startswith(b"\xff\xd8\xff"):
            raise HTTPException(status_code=400, detail="Invalid JPEG image file header.")
    elif ext == "png":
        if not content.startswith(b"\x89PNG\r\n\x1a\n"):
            raise HTTPException(status_code=400, detail="Invalid PNG image file header.")
    elif ext == "webp":
        if not (content.startswith(b"RIFF") and len(content) >= 12 and content[8:12] == b"WEBP"):
            raise HTTPException(status_code=400, detail="Invalid WebP image file header.")

    # 4. Notify WebSocket client about extraction status
    await session_manager.broadcast_status(submission_id, "Parsing document structure...", progress=10)

    # 5. Parse Document into Pages
    try:
        if ext == "pdf":
            parse_result = parse_pdf_document(content)
        elif ext == "docx":
            parse_result = parse_docx_document(content)
        else:
            parse_result = parse_image_document(content, filename)
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as parse_err:
        logger.error(f"[DocumentUpload] Parsing error: {parse_err}")
        raise HTTPException(status_code=400, detail=f"Failed to parse document: {parse_err}")

    # Define progress callback for vision pages
    async def _on_vision_progress(page_num: int, total_vision_pages: int):
        pct = int(20 + (page_num / max(1, total_vision_pages)) * 60)
        await session_manager.broadcast_status(
            submission_id,
            f"Reading page {page_num} of {total_vision_pages}",
            progress=pct
        )

    # 6. Extract proposals using Vision & Doc LLM Pipeline with Timeout
    try:
        proposals_data = await asyncio.wait_for(
            extract_proposals_from_document(
                parse_result,
                fields,
                progress_callback=_on_vision_progress
            ),
            timeout=float(settings.DOC_EXTRACT_TIMEOUT_S)
        )
    except asyncio.TimeoutError:
        logger.error(f"[DocumentUpload] Extraction timed out after {settings.DOC_EXTRACT_TIMEOUT_S}s.")
        raise HTTPException(
            status_code=504,
            detail="Document extraction timed out. Please try uploading a shorter document or retry."
        )
    except Exception as ext_err:
        logger.error(f"[DocumentUpload] Extraction exception: {ext_err}")
        proposals_data = []

    # 7. Delete existing pending proposals for this submission and insert new ones
    delete_existing = (
        models.SubmissionProposal.__table__.delete()
        .where(models.SubmissionProposal.submission_id == submission_id)
        .where(models.SubmissionProposal.status == "pending")
    )
    await db.execute(delete_existing)

    inserted_proposals: List[models.SubmissionProposal] = []
    field_map = {f.id: f for f in fields}

    for p_info in proposals_data:
        prop = models.SubmissionProposal(
            submission_id=submission_id,
            field_id=p_info["field_id"],
            value=p_info["value"],
            confidence=p_info["confidence"],
            evidence=p_info.get("evidence"),
            page=p_info.get("page"),
            read_method=p_info.get("read_method", "text_layer"),
            status="pending",
            alternatives=p_info.get("alternatives", [])
        )
        db.add(prop)
        inserted_proposals.append(prop)

    await db.commit()

    # Re-fetch proposals with IDs
    for p in inserted_proposals:
        await db.refresh(p)

    # Convert to response objects
    prop_responses: List[schemas.SubmissionProposalResponse] = []
    sensitive_types = {"Email", "Phone", "Number", "Date"}

    for p in inserted_proposals:
        f_obj = field_map.get(p.field_id)
        f_name = f_obj.field_name if f_obj else f"field_{p.field_id}"
        f_type = f_obj.data_type if f_obj else "String"

        is_scanned = (p.read_method == "vision")
        is_excluded = is_scanned and (f_type in sensitive_types)
        scanned_warn = "Read from a scanned page. Check this one." if is_scanned else None

        prop_responses.append(schemas.SubmissionProposalResponse(
            id=p.id,
            submission_id=p.submission_id,
            field_id=p.field_id,
            field_name=f_name,
            value=p.value,
            confidence=p.confidence,
            evidence=p.evidence,
            page=p.page,
            read_method=p.read_method,
            status=p.status,
            alternatives=p.alternatives,
            is_excluded_from_accept_all=is_excluded,
            scanned_warning=scanned_warn,
            created_at=p.created_at
        ))

    # 8. Notify WebSocket session of new state & proposals
    await session_manager.sync_proposals_to_session(submission_id, db)
    await session_manager.broadcast_status(submission_id, "Document extraction complete.", progress=100)

    out_msg = f"Extracted {len(prop_responses)} proposals from document."
    if parse_result.warning_msg:
        out_msg += f" ({parse_result.warning_msg})"

    await record_audit_event(
        db,
        action="document_upload",
        actor_id=current_user.id,
        actor_role=current_user.role,
        target_type="submission",
        target_id=str(submission_id),
        details={"filename": filename, "format": ext, "proposals_count": len(prop_responses)}
    )

    return schemas.DocumentUploadResponse(
        submission_id=submission_id,
        extracted_count=len(prop_responses),
        proposals=prop_responses,
        warning=parse_result.warning_msg,
        message=out_msg
    )
