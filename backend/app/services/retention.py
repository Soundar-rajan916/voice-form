from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models import Submission
from app.services.audit import record_audit_event

async def cleanup_expired_submissions(db: AsyncSession) -> int:
    """
    Finds and deletes submitted applications that have passed their retention expiration.
    Records an audit log entry for each deletion.
    """
    now = datetime.utcnow()
    stmt = (
        select(Submission)
        .where(
            Submission.status == "submitted",
            Submission.retention_expires_at.is_not(None),
            Submission.retention_expires_at <= now
        )
    )
    res = await db.execute(stmt)
    expired = res.scalars().all()

    if not expired:
        return 0

    count = 0
    for sub in expired:
        ref_num = sub.reference_number or f"sub-{sub.id}"
        await record_audit_event(
            db,
            action="retention_cleanup",
            actor_id=None,
            actor_role="system",
            target_type="submission",
            target_id=str(sub.id),
            details={
                "reference_number": ref_num,
                "channel": sub.channel,
                "retention_expires_at": sub.retention_expires_at.isoformat() if sub.retention_expires_at else None
            }
        )
        await db.delete(sub)
        count += 1

    await db.commit()
    print(f"[Retention Cleanup] Purged {count} expired submissions.")
    return count
