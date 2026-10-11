from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.db import get_db
from app.deps import require_admin
from app.services.retention import cleanup_expired_submissions

router = APIRouter(prefix="/admin", tags=["admin-system"])

@router.post("/retention/cleanup")
async def trigger_retention_cleanup(
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """Triggers immediate retention purge for applications expired beyond RETENTION_DAYS."""
    purged_count = await cleanup_expired_submissions(db)
    await record_audit_event(
        db,
        action="retention_cleanup_manual",
        actor_id=current_user.id,
        actor_role=current_user.role,
        target_type="system",
        details={"purged_count": purged_count}
    )
    return {"status": "success", "purged_count": purged_count}
