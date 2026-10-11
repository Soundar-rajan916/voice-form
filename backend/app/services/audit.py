from typing import Optional, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from app.models import AuditLog

async def record_audit_event(
    db: AsyncSession,
    action: str,
    actor_id: Optional[int] = None,
    actor_role: Optional[str] = None,
    target_type: Optional[str] = None,
    target_id: Optional[str] = None,
    details: Optional[Dict[str, Any]] = None
) -> AuditLog:
    """
    Records an immutable audit log entry in the audit_logs table.
    Actions include: view, print, export, delete, role_change, kiosk_revoke, retention_cleanup, login, help_request
    """
    entry = AuditLog(
        actor_id=actor_id,
        actor_role=actor_role,
        action=action,
        target_type=target_type,
        target_id=str(target_id) if target_id is not None else None,
        details=details or {}
    )
    db.add(entry)
    await db.commit()
    return entry
