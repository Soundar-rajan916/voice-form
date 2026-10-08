from typing import Dict, Any, Optional, List
from app.models import Submission, FormVersion, FormField

class FormSessionManager:
    """
    In-memory session manager for a live voice filling session.
    Keeps form version schema and state in server memory so no DB reads occur between turns.
    """
    def __init__(self, submission: Submission, version: FormVersion):
        self.submission_id: int = submission.id
        self.form_id: int = submission.form_id
        self.form_version_id: int = version.id
        self.version_number: int = version.version_number
        self.user_id: int = submission.user_id

        # Sort fields by position
        self.fields: List[FormField] = sorted(version.fields, key=lambda f: f.position)
        self.current_field_index: int = 0
        self.answers: Dict[int, Dict[str, Any]] = {} # field_id -> {value, raw_transcript, language}
        self.retry_counts: Dict[int, int] = {} # field_index -> count
        self.accumulated_transcripts: Dict[int, str] = {} # field_index -> accumulated text

        # Load any existing answers if resuming
        for ans in submission.answers:
            if ans.value is not None:
                self.answers[ans.field_id] = {
                    "value": ans.value,
                    "raw_transcript": ans.raw_transcript,
                    "language": ans.language
                }

        # Calculate current_field_index based on first unanswered required field
        self.update_current_field_index()

    def update_current_field_index(self):
        """Sets current_field_index to the first unanswered field."""
        for idx, field in enumerate(self.fields):
            ans = self.answers.get(field.id)
            if not ans or ans.get("value") is None:
                self.current_field_index = idx
                return
        # If all fields answered, set index to last index
        self.current_field_index = max(0, len(self.fields) - 1)

    def get_current_field(self) -> Optional[FormField]:
        if 0 <= self.current_field_index < len(self.fields):
            return self.fields[self.current_field_index]
        return None

    def record_answer(self, field_id: int, value: str, raw_transcript: str, language: str):
        self.answers[field_id] = {
            "value": value,
            "raw_transcript": raw_transcript,
            "language": language
        }
        # Reset retries for current field
        self.retry_counts[self.current_field_index] = 0
        self.accumulated_transcripts[self.current_field_index] = ""

    def advance(self) -> bool:
        """Advance to next unanswered question. Returns True if advanced, False if reached end."""
        self.update_current_field_index()
        if self.is_complete():
            return False
        return True

    def go_back(self) -> bool:
        """Go back to previous question. Returns True if went back, False if at first."""
        if self.current_field_index > 0:
            self.current_field_index -= 1
            return True
        return False

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
        """Session is complete ONLY when every required field has an accepted non-null value."""
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
            "done": self.is_complete()
        }
