from typing import Dict, Any, Optional, List
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Submission, FormVersion, FormField, SubmissionAnswer, SubmissionProposal
from app.services.filters import strip_emojis

SENSITIVE_DATA_TYPES = {"Email", "Phone", "Number", "Date"}

class FormSessionManager:
    """
    In-memory session manager for a live voice filling session.
    Single source of truth for current_field, answered fields, mode, proposals, and completion state.
    """
    def __init__(self, submission: Submission, version: FormVersion):
        self.submission_id: int = submission.id
        self.form_id: int = submission.form_id
        self.form_version_id: int = version.id
        self.version_number: int = version.version_number
        self.user_id: int = submission.user_id
        self.submission_status: str = getattr(submission, "status", "in_progress") or "in_progress"

        # Sort fields by position
        self.fields: List[FormField] = sorted(version.fields, key=lambda f: f.position)
        self.current_field_index: int = 0
        self.answers: Dict[int, Dict[str, Any]] = {} # field_id -> {value, raw_transcript, language}
        self.proposals: Dict[int, Dict[str, Any]] = {} # proposal_id -> proposal dict
        self.history: List[int] = [] # list of answered field_ids for undo_last()
        self.retry_counts: Dict[int, int] = {} # field_index -> count
        self.accumulated_transcripts: Dict[int, str] = {} # field_index -> accumulated text

        # Editing mode state & turn tracking
        self.mode: str = "normal" # "normal" or "editing"
        self.editing_field_id: Optional[int] = None
        self.turn_number: int = 0
        self.last_processed_turn_number: int = -1

        # Echo Guard & Bot Message History
        self.recent_bot_messages: List[str] = []
        self.echo_drop_count: int = 0

        # Active websocket connections map: submission_id -> websocket
        self.websockets: List[Any] = []

        # Load existing answers
        field_map = {f.id: f for f in self.fields}
        for ans in submission.answers:
            if ans.value is not None:
                val = ans.value
                f_obj = field_map.get(ans.field_id)
                if f_obj and getattr(f_obj, "is_sensitive_number", False) and val:
                    from app.services.crypto import decrypt_field_value, mask_field_value
                    plain = decrypt_field_value(val)
                    val = mask_field_value(plain)
                self.answers[ans.field_id] = {
                    "value": strip_emojis(str(val)) if val and not str(val).startswith("enc:") else val,
                    "raw_transcript": ans.raw_transcript,
                    "language": ans.language,
                    "source": ans.source or "typed",
                    "evidence": ans.evidence
                }
                if ans.field_id not in self.history:
                    self.history.append(ans.field_id)

        # Load existing proposals
        if hasattr(submission, "proposals") and submission.proposals:
            field_map = {f.id: f for f in self.fields}
            for prop in submission.proposals:
                if prop.status == "pending":
                    f_obj = field_map.get(prop.field_id)
                    f_name = f_obj.field_name if f_obj else f"field_{prop.field_id}"
                    f_type = f_obj.data_type if f_obj else "String"

                    is_scanned = (prop.read_method == "vision")
                    is_excluded = is_scanned and (f_type in SENSITIVE_DATA_TYPES)
                    scanned_warn = "Read from a scanned page. Check this one." if is_scanned else None

                    self.proposals[prop.id] = {
                        "id": prop.id,
                        "submission_id": prop.submission_id,
                        "field_id": prop.field_id,
                        "field_name": f_name,
                        "value": strip_emojis(str(prop.value)) if prop.value else prop.value,
                        "confidence": prop.confidence,
                        "evidence": strip_emojis(str(prop.evidence)) if prop.evidence else prop.evidence,
                        "page": prop.page,
                        "read_method": prop.read_method,
                        "status": prop.status,
                        "alternatives": prop.alternatives or [],
                        "is_excluded_from_accept_all": is_excluded,
                        "scanned_warning": scanned_warn
                    }

        self.update_current_field_index()

    def is_locked(self) -> bool:
        return self.submission_status in ["submitted", "completed"]

    def update_current_field_index(self):
        """Sets current_field_index to the first unanswered field, or last field if all answered."""
        for idx, field in enumerate(self.fields):
            ans = self.answers.get(field.id)
            if not ans or ans.get("value") is None or str(ans.get("value")).strip() == "":
                self.current_field_index = idx
                return
        self.current_field_index = max(0, len(self.fields) - 1)

    def add_bot_message(self, text: str):
        cleaned = strip_emojis(text).strip() if text else ""
        if cleaned:
            self.recent_bot_messages.append(cleaned)
            if len(self.recent_bot_messages) > 10:
                self.recent_bot_messages.pop(0)

    def get_friendly_field_name(self, field: Optional[FormField] = None) -> str:
        f = field or self.get_current_field()
        if not f:
            return "field"
        fname = f.field_name.replace("_", " ").title()
        if f.data_type == "Email" and "email" not in fname.lower():
            return "email address"
        if f.data_type == "Phone" and "phone" not in fname.lower() and "mobile" not in fname.lower():
            return "phone number"
        return fname

    def get_current_field(self) -> Optional[FormField]:
        if 0 <= self.current_field_index < len(self.fields):
            return self.fields[self.current_field_index]
        return None

    def get_field_by_id(self, field_id: int) -> Optional[FormField]:
        for f in self.fields:
            if f.id == field_id:
                return f
        return None

    def reset_retries(self, field_id: Optional[int] = None):
        if field_id:
            field = self.get_field_by_id(field_id)
            if field and field in self.fields:
                idx = self.fields.index(field)
                self.retry_counts[idx] = 0
        else:
            self.retry_counts[self.current_field_index] = 0

    def goto(self, field_id: int) -> bool:
        field = self.get_field_by_id(field_id)
        if not field:
            return False

        idx = self.fields.index(field)
        self.current_field_index = idx
        self.mode = "editing"
        self.editing_field_id = field_id
        self.reset_retries()
        return True

    def cancel_editing(self):
        self.mode = "normal"
        self.editing_field_id = None
        self.update_current_field_index()
        self.reset_retries()

    def go_back(self) -> bool:
        if self.current_field_index > 0:
            self.current_field_index -= 1
            self.mode = "normal"
            self.editing_field_id = None
            self.reset_retries()
            return True
        return False

    def undo_last(self) -> Optional[int]:
        field_id_to_undo = None
        if self.history:
            field_id_to_undo = self.history.pop()
        elif self.answers:
            field_id_to_undo = list(self.answers.keys())[-1]

        if field_id_to_undo is not None:
            if field_id_to_undo in self.answers:
                del self.answers[field_id_to_undo]

            target_field = self.get_field_by_id(field_id_to_undo)
            if target_field:
                self.current_field_index = self.fields.index(target_field)

            self.mode = "normal"
            self.editing_field_id = None
            self.reset_retries()
            return field_id_to_undo

        return None

    def record_answer(self, field_id: int, value: str, raw_transcript: str, language: str, source: str = "typed", evidence: Optional[str] = None):
        clean_val = strip_emojis(str(value)) if (value is not None and not str(value).startswith("enc:")) else value
        self.answers[field_id] = {
            "value": clean_val,
            "raw_transcript": raw_transcript,
            "language": language,
            "source": source,
            "evidence": evidence
        }
        if field_id in self.history:
            self.history.remove(field_id)
        self.history.append(field_id)
        self.retry_counts[self.current_field_index] = 0
        self.accumulated_transcripts[self.current_field_index] = ""

    def advance(self) -> bool:
        self.turn_number += 1
        if self.mode == "editing":
            self.mode = "normal"
            self.editing_field_id = None
            self.update_current_field_index()
        else:
            self.update_current_field_index()

        self.reset_retries()
        return self.is_complete()

    def increment_retry(self) -> int:
        idx = self.current_field_index
        count = self.retry_counts.get(idx, 0) + 1
        self.retry_counts[idx] = count
        return count

    def append_accumulated_transcript(self, text: str):
        idx = self.current_field_index
        existing = self.accumulated_transcripts.get(idx, "")
        self.accumulated_transcripts[idx] = f"{existing} {text}".strip()

    def get_accumulated_transcript(self) -> str:
        return self.accumulated_transcripts.get(self.current_field_index, "")

    def is_complete(self) -> bool:
        if not self.fields:
            return False
        for field in self.fields:
            if field.required:
                ans = self.answers.get(field.id)
                if not ans or ans.get("value") is None or str(ans.get("value")).strip() == "":
                    return False
        return True

    def build_state_dict(self) -> dict:
        current_f = self.get_current_field()
        all_ans = self.is_complete()
        effective_mode = "editing" if self.mode == "editing" else ("review" if all_ans else "normal")
        can_edit = not self.is_locked()

        return {
            "current_field": {
                "id": current_f.id,
                "field_name": current_f.field_name,
                "data_type": current_f.data_type,
                "description": current_f.description,
                "required": current_f.required,
                "position": current_f.position,
                "choices": current_f.choices,
                "question_en": current_f.question_en,
                "question_ta": current_f.question_ta
            } if current_f else None,
            "current_field_index": self.current_field_index,
            "answered_count": len([f for f in self.fields if f.id in self.answers and self.answers[f.id].get("value")]),
            "total_fields": len(self.fields),
            "all_answered": all_ans,
            "can_edit": can_edit,
            "done": self.is_locked(),
            "mode": effective_mode,
            "editing_field_id": self.editing_field_id,
            "turn_number": self.turn_number,
            "submission_id": self.submission_id,
            "answers": self.answers,
            "proposals": list(self.proposals.values()),
            "submission_status": self.submission_status
        }


class GlobalSessionManagerService:
    """
    Service wrapper around active FormSessionManagers across WebSocket connections.
    """
    def __init__(self):
        self.active_sessions: Dict[int, FormSessionManager] = {}

    def get_session(self, submission_id: int) -> Optional[FormSessionManager]:
        return self.active_sessions.get(submission_id)

    def register_session(self, submission_id: int, session: FormSessionManager):
        self.active_sessions[submission_id] = session

    def remove_session(self, submission_id: int):
        if submission_id in self.active_sessions:
            del self.active_sessions[submission_id]

    async def broadcast_status(self, submission_id: int, message: str, progress: int = 0):
        session = self.get_session(submission_id)
        if session and session.websockets:
            payload = {
                "type": "document_status",
                "message": message,
                "progress": progress
            }
            for ws in list(session.websockets):
                try:
                    await ws.send_json(payload)
                except Exception:
                    pass

    async def sync_proposals_to_session(self, submission_id: int, db: AsyncSession):
        session = self.get_session(submission_id)
        res = await db.execute(
            select(SubmissionProposal)
            .where(SubmissionProposal.submission_id == submission_id)
            .where(SubmissionProposal.status == "pending")
        )
        db_proposals = res.scalars().all()

        field_map = {f.id: f for f in session.fields} if session else {}
        new_props = {}

        for prop in db_proposals:
            f_obj = field_map.get(prop.field_id)
            f_name = f_obj.field_name if f_obj else f"field_{prop.field_id}"
            f_type = f_obj.data_type if f_obj else "String"

            is_scanned = (prop.read_method == "vision")
            is_excluded = is_scanned and (f_type in SENSITIVE_DATA_TYPES)
            scanned_warn = "Read from a scanned page. Check this one." if is_scanned else None

            new_props[prop.id] = {
                "id": prop.id,
                "submission_id": prop.submission_id,
                "field_id": prop.field_id,
                "field_name": f_name,
                "value": prop.value,
                "confidence": prop.confidence,
                "evidence": prop.evidence,
                "page": prop.page,
                "read_method": prop.read_method,
                "status": prop.status,
                "alternatives": prop.alternatives or [],
                "is_excluded_from_accept_all": is_excluded,
                "scanned_warning": scanned_warn
            }

        if session:
            session.proposals = new_props
            await self.broadcast_state(submission_id)

    async def broadcast_state(self, submission_id: int):
        session = self.get_session(submission_id)
        if session and session.websockets:
            st = session.build_state_dict()
            st["type"] = "state_sync"
            for ws in list(session.websockets):
                try:
                    await ws.send_json(st)
                except Exception:
                    pass

    async def accept_proposals(
        self,
        submission_id: int,
        proposal_ids: Optional[List[int]],
        db: AsyncSession
    ) -> List[int]:
        session = self.get_session(submission_id)
        if not session or session.is_locked():
            return []

        accepted_ids = []
        is_bulk_accept_all = (proposal_ids is None or len(proposal_ids) == 0)

        # Target proposals
        if is_bulk_accept_all:
            # Filter out proposals where is_excluded_from_accept_all is True
            target_props = [
                p for p in session.proposals.values()
                if not p.get("is_excluded_from_accept_all", False)
            ]
        else:
            target_props = [
                p for p in session.proposals.values()
                if p["id"] in proposal_ids
            ]

        for p in target_props:
            pid = p["id"]
            fid = p["field_id"]
            val = p["value"]
            ev = p["evidence"]

            # Record answer in DB
            res = await db.execute(
                select(SubmissionAnswer).where(
                    SubmissionAnswer.submission_id == submission_id,
                    SubmissionAnswer.field_id == fid
                )
            )
            ans = res.scalar_one_or_none()
            if ans:
                ans.value = val
                ans.source = "document"
                ans.evidence = ev
                ans.raw_transcript = f"Accepted document proposal: {val}"
                ans.language = "document"
            else:
                ans = SubmissionAnswer(
                    submission_id=submission_id,
                    field_id=fid,
                    value=val,
                    source="document",
                    evidence=ev,
                    raw_transcript=f"Accepted document proposal: {val}",
                    language="document"
                )
                db.add(ans)

            # Update proposal status in DB
            prop_db_res = await db.execute(
                select(SubmissionProposal).where(SubmissionProposal.id == pid)
            )
            prop_db = prop_db_res.scalar_one_or_none()
            if prop_db:
                prop_db.status = "accepted"

            # Update in-memory session
            session.record_answer(fid, val, f"Accepted document proposal: {val}", "document", source="document", evidence=ev)
            if pid in session.proposals:
                del session.proposals[pid]
            accepted_ids.append(pid)

        await db.commit()
        session.update_current_field_index()
        await self.broadcast_state(submission_id)
        return accepted_ids

    async def dismiss_proposal(self, submission_id: int, proposal_id: int, db: AsyncSession):
        session = self.get_session(submission_id)
        if not session or session.is_locked():
            return

        prop_db_res = await db.execute(
            select(SubmissionProposal).where(SubmissionProposal.id == proposal_id)
        )
        prop_db = prop_db_res.scalar_one_or_none()
        if prop_db:
            prop_db.status = "dismissed"
            await db.commit()

        if session and proposal_id in session.proposals:
            del session.proposals[proposal_id]
            await self.broadcast_state(submission_id)

    async def edit_proposal(self, submission_id: int, proposal_id: int, new_value: str, db: AsyncSession):
        session = self.get_session(submission_id)
        if not session or session.is_locked():
            return

        if session and proposal_id in session.proposals:
            session.proposals[proposal_id]["value"] = new_value
            await self.accept_proposals(submission_id, [proposal_id], db)


session_manager = GlobalSessionManagerService()
