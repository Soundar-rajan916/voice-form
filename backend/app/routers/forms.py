from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from typing import List

from app.db import get_db
from app.models import User, Form, FormVersion
from app.schemas import FormResponse, FormDetailResponse, FormVersionResponse
from app.deps import require_user

router = APIRouter(prefix="/forms", tags=["user-forms"])

@router.get("", response_model=List[FormResponse])
async def list_published_forms(
    current_user: User = Depends(require_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Form)
        .options(selectinload(Form.versions).selectinload(FormVersion.fields))
        .where(Form.status == "published")
        .order_by(Form.updated_at.desc())
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
async def get_published_form(
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
    if not form:
        raise HTTPException(status_code=404, detail="Form not found or not published")

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
