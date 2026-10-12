from datetime import datetime
from typing import List, Optional, Literal, Any, Dict
from pydantic import BaseModel, EmailStr, Field, ConfigDict

# --- AUTH SCHEMAS ---
class UserRegister(BaseModel):
    email: EmailStr
    username: Optional[str] = None
    password: str = Field(..., min_length=6)

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: int
    email: str
    username: Optional[str] = None
    role: str
    is_active: bool = True
    device_name: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

class TokenData(BaseModel):
    user_id: int
    role: str

# --- FORM FIELD SCHEMAS ---
DataTypeEnum = Literal["String", "Number", "Email", "Phone", "Date", "Boolean", "Choice"]

class FormFieldCreate(BaseModel):
    field_name: str
    data_type: DataTypeEnum
    description: str
    required: bool = True
    position: int = 0
    choices: Optional[List[str]] = None
    question_en: Optional[str] = None
    question_ta: Optional[str] = None
    is_sensitive_number: bool = False

class FormFieldResponse(BaseModel):
    id: int
    form_version_id: int
    field_name: str
    data_type: str
    description: str
    required: bool
    position: int
    choices: Optional[List[str]] = None
    question_en: Optional[str] = None
    question_ta: Optional[str] = None
    is_sensitive_number: bool = False

    model_config = ConfigDict(from_attributes=True)

# --- FORM VERSION SCHEMAS ---
class FormVersionResponse(BaseModel):
    id: int
    form_id: int
    version_number: int
    created_at: datetime
    fields: List[FormFieldResponse] = []

    model_config = ConfigDict(from_attributes=True)

# --- FORM SCHEMAS ---
class FormCreate(BaseModel):
    title: str
    description: Optional[str] = None
    allow_document_upload: bool = True
    fields: List[FormFieldCreate] = []

class FormUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    allow_document_upload: Optional[bool] = None
    fields: Optional[List[FormFieldCreate]] = None

class FormResponse(BaseModel):
    id: int
    title: str
    description: Optional[str] = None
    status: str
    allow_document_upload: bool = True
    created_by: int
    created_at: datetime
    updated_at: datetime
    latest_version_number: Optional[int] = None
    field_count: Optional[int] = 0

    model_config = ConfigDict(from_attributes=True)

class FormDetailResponse(BaseModel):
    id: int
    title: str
    description: Optional[str] = None
    status: str
    allow_document_upload: bool = True
    created_by: int
    created_at: datetime
    updated_at: datetime
    current_version: Optional[FormVersionResponse] = None

    model_config = ConfigDict(from_attributes=True)

# --- PROPOSAL SCHEMAS ---
class SubmissionProposalResponse(BaseModel):
    id: int
    submission_id: int
    field_id: int
    field_name: Optional[str] = None
    value: str
    confidence: float
    evidence: Optional[str] = None
    page: Optional[int] = None
    read_method: str = "text_layer" # "text_layer" or "vision"
    status: str = "pending" # "pending", "accepted", "dismissed"
    alternatives: Optional[List[Any]] = None
    is_excluded_from_accept_all: Optional[bool] = False
    scanned_warning: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class DocumentUploadResponse(BaseModel):
    submission_id: int
    extracted_count: int
    proposals: List[SubmissionProposalResponse] = []
    warning: Optional[str] = None
    message: Optional[str] = None

class AcceptProposalsRequest(BaseModel):
    proposal_ids: Optional[List[int]] = None

class DismissProposalRequest(BaseModel):
    proposal_id: int

class EditProposalRequest(BaseModel):
    proposal_id: int
    new_value: str

# --- SUBMISSION SCHEMAS ---
class SubmissionAnswerCreate(BaseModel):
    field_id: int
    value: Optional[str] = None
    raw_transcript: Optional[str] = None
    language: Optional[str] = None

class SubmissionAnswerResponse(BaseModel):
    id: int
    submission_id: int
    field_id: int
    value: Optional[str] = None
    raw_transcript: Optional[str] = None
    language: Optional[str] = None
    source: Optional[str] = "typed"
    evidence: Optional[str] = None
    source_confidence: Optional[float] = None
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

class SubmissionResponse(BaseModel):
    id: int
    form_id: int
    form_version_id: int
    user_id: int
    status: str
    started_at: datetime
    completed_at: Optional[datetime] = None
    submitted_at: Optional[datetime] = None
    submission_title: Optional[str] = None
    submission_name: Optional[str] = None
    all_answered: Optional[bool] = False
    can_edit: Optional[bool] = True
    reference_number: Optional[str] = None
    channel: str = "online"
    assisted_by: Optional[int] = None
    kiosk_id: Optional[int] = None
    consent_at: Optional[datetime] = None
    consent_noted_by: Optional[str] = None
    language_chosen: str = "ta"
    retention_expires_at: Optional[datetime] = None
    print_count: int = 0

    model_config = ConfigDict(from_attributes=True)

class SubmissionDetailResponse(BaseModel):
    id: int
    form_id: int
    form_version_id: int
    version_number: int
    user_id: int
    user_email: Optional[str] = None
    status: str
    started_at: datetime
    completed_at: Optional[datetime] = None
    submitted_at: Optional[datetime] = None
    submission_title: Optional[str] = None
    submission_name: Optional[str] = None
    all_answered: Optional[bool] = False
    can_edit: Optional[bool] = True
    reference_number: Optional[str] = None
    channel: str = "online"
    assisted_by: Optional[int] = None
    kiosk_id: Optional[int] = None
    consent_at: Optional[datetime] = None
    consent_noted_by: Optional[str] = None
    language_chosen: str = "ta"
    retention_expires_at: Optional[datetime] = None
    print_count: int = 0
    answers: List[SubmissionAnswerResponse] = []
    proposals: List[SubmissionProposalResponse] = []
    fields: List[FormFieldResponse] = []

    model_config = ConfigDict(from_attributes=True)

# Audit Log
class AuditLogResponse(BaseModel):
    id: int
    actor_id: Optional[int] = None
    actor_role: Optional[str] = None
    action: str
    target_type: Optional[str] = None
    target_id: Optional[str] = None
    details: Optional[Dict[str, Any]] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

# --- ANSWER EXTRACTION SCHEMA (LLM Output) ---
class ExtractionResult(BaseModel):
    intent: Literal[
        "answer", "back", "skip", "repeat", "change_field", "confirm", "deny", "unrelated"
    ] = "answer"
    value: Optional[str] = None
    fulfilled: bool = False
    incomplete: bool = False
    follow_up: Optional[str] = None
    target_field: Optional[str] = None
