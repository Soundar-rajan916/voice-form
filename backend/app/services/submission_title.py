from typing import List, Dict, Optional
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from app.models import Submission, Form

async def compute_submission_title(
    db: AsyncSession,
    sub: Submission,
    form_title: Optional[str] = None
) -> str:
    """
    Computes submission title formatted like: <form_title>-<submission_number>
    e.g. hospital-1, hospital-2, general form-1
    """
    if not form_title:
        if sub.form and sub.form.title:
            form_title = sub.form.title
        elif sub.version and sub.version.form and sub.version.form.title:
            form_title = sub.version.form.title
        else:
            res = await db.execute(select(Form.title).where(Form.id == sub.form_id))
            form_title = res.scalar_one_or_none() or "form"

    res_count = await db.execute(
        select(func.count(Submission.id)).where(
            Submission.form_id == sub.form_id,
            Submission.id <= sub.id
        )
    )
    sub_num = res_count.scalar() or 1
    return f"{form_title.lower()}-{sub_num}"

async def compute_submission_titles_batch(
    db: AsyncSession,
    submissions: List[Submission]
) -> Dict[int, str]:
    """
    Batch computes submission titles for a list of Submission objects.
    Returns mapping from submission.id to title string (e.g. {1: "hospital-1", 2: "hospital-2"}).
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

    form_sub_numbers: Dict[tuple, int] = {}
    for fid in form_ids:
        res_subs = await db.execute(
            select(Submission.id)
            .where(Submission.form_id == fid)
            .order_by(Submission.id.asc())
        )
        sub_ids = res_subs.scalars().all()
        for idx, sid in enumerate(sub_ids, start=1):
            form_sub_numbers[(fid, sid)] = idx

    title_map: Dict[int, str] = {}
    for s in submissions:
        title = form_titles.get(s.form_id, "form")
        num = form_sub_numbers.get((s.form_id, s.id), 1)
        title_map[s.id] = f"{title.lower()}-{num}"

    return title_map
