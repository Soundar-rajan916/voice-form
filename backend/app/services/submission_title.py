from typing import List, Dict, Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models import Submission, Form

async def compute_submission_title(
    db: AsyncSession,
    sub: Submission,
    form_title: Optional[str] = None
) -> str:
    """
    Computes submission title formatted like: <form_title>
    e.g. hospital, general form
    """
    if not form_title:
        if sub.form and sub.form.title:
            form_title = sub.form.title
        elif sub.version and sub.version.form and sub.version.form.title:
            form_title = sub.version.form.title
        else:
            res = await db.execute(select(Form.title).where(Form.id == sub.form_id))
            form_title = res.scalar_one_or_none() or "form"

    return form_title.lower()

async def compute_submission_titles_batch(
    db: AsyncSession,
    submissions: List[Submission]
) -> Dict[int, str]:
    """
    Batch computes submission titles for a list of Submission objects.
    Returns mapping from submission.id to title string (e.g. {1: "hospital", 2: "hospital"}).
    """
    if not submissions:
        return {}

    form_ids = {s.form_id for s in submissions}

    form_titles: Dict[int, str] = {}
    for s in submissions:
        if s.form and s.form.title:
            form_titles[s.form_id] = s.form.title
        elif s.version and s.version.form and s.version.form.title:
            form_titles[s.form_id] = s.version.form.title

    missing_form_ids = form_ids - set(form_titles.keys())
    if missing_form_ids:
        res = await db.execute(select(Form.id, Form.title).where(Form.id.in_(missing_form_ids)))
        for fid, title in res.all():
            form_titles[fid] = title

    title_map: Dict[int, str] = {}
    for s in submissions:
        title = form_titles.get(s.form_id, "form")
        title_map[s.id] = title.lower()

    return title_map
