from typing import Dict, Any, Optional, List
from app.models import Submission, FormVersion, FormField

class FormSessionManager:
    """
    In-memory session manager for a live voice filling session.
    Single source of truth for current_field, answered fields, mode, and completion state.
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
        self.history: List[int] = [] # list of answered field_ids for undo_last()
        self.retry_counts: Dict[int, int] = {} # field_index -> count
        self.accumulated_transcripts: Dict[int, str] = {} # field_index -> accumulated text

        # Editing mode state & turn tracking
        self.mode: str = "normal" # "normal" or "editing"
        self.editing_field_id: Optional[int] = None
        self.turn_number: int = 0
        self.last_processed_turn_number: int = -1

        # Echo Guard & Bot Message History (Fix A & Fix G)
        self.recent_bot_messages: List[str] = []
        self.echo_drop_count: int = 0

        # Load any existing answers if resuming
        for ans in submission.answers:
            if ans.value is not None:
                self.answers[ans.field_id] = {
                    "value": ans.value,
                    "raw_transcript": ans.raw_transcript,
                    "language": ans.language
                }
                if ans.field_id not in self.history:
                    self.history.append(ans.field_id)

        # Calculate current_field_index based on first unanswered required field
        self.update_current_field_index()

    def is_locked(self) -> bool:
        """Submitted or completed submissions are locked and cannot be edited."""
        return self.submission_status in ["submitted", "completed"]

    def update_current_field_index(self):
        """Sets current_field_index to the first unanswered field, or last field if all answered."""
        for idx, field in enumerate(self.fields):
            ans = self.answers.get(field.id)
            if not ans or ans.get("value") is None or str(ans.get("value")).strip() == "":
                self.current_field_index = idx
                return
        # If all fields answered, set index to last field
        self.current_field_index = max(0, len(self.fields) - 1)

    def add_bot_message(self, text: str):
        if text and text.strip():
            self.recent_bot_messages.append(text.strip())
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
        """Resets retry counter for active field or specific field."""
        if field_id:
            field = self.get_field_by_id(field_id)
            if field and field in self.fields:
                idx = self.fields.index(field)
                self.retry_counts[idx] = 0
        else:
            self.retry_counts[self.current_field_index] = 0

    def goto(self, field_id: int) -> bool:
        """Sets active field to field_id and enters editing mode. Keeps existing answers intact."""
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
        """Cancels editing mode and returns to review or normal state."""
        self.mode = "normal"
        self.editing_field_id = None
        self.update_current_field_index()
        self.reset_retries()

    def go_back(self) -> bool:
        """Go back to previous question. Returns True if moved, False if at first."""
        if self.current_field_index > 0:
            self.current_field_index -= 1
            self.mode = "normal"
            self.editing_field_id = None
            self.reset_retries()
            return True
        return False

    def undo_last(self) -> Optional[int]:
        """Reverts the last answered field and resets current_field_index to it."""
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

    def record_answer(self, field_id: int, value: str, raw_transcript: str, language: str):
        self.answers[field_id] = {
            "value": value,
            "raw_transcript": raw_transcript,
            "language": language
        }
        if field_id in self.history:
            self.history.remove(field_id)
        self.history.append(field_id)

        # Reset retries for current field
        self.retry_counts[self.current_field_index] = 0
        self.accumulated_transcripts[self.current_field_index] = ""

    def advance(self) -> bool:
        """Advance turn. Return all_answered boolean."""
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
        """all_answered: returns True ONLY when every required field has an accepted non-null value."""
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
            "submission_status": self.submission_status
        }
