from datetime import datetime
from typing import List, Optional, Literal
from pydantic import BaseModel, EmailStr, Field, ConfigDict

# --- AUTH SCHEMAS ---
class UserRegister(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=6)

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: int
    email: str
    role: str
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
    fields: List[FormFieldCreate] = []

class FormUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    fields: Optional[List[FormFieldCreate]] = None

class FormResponse(BaseModel):
    id: int
    title: str
    description: Optional[str] = None
    status: str
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
    created_by: int
    created_at: datetime
    updated_at: datetime
    current_version: Optional[FormVersionResponse] = None

    model_config = ConfigDict(from_attributes=True)

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
    submission_title: Optional[str] = None
    submission_name: Optional[str] = None

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
    submission_title: Optional[str] = None
    submission_name: Optional[str] = None
    answers: List[SubmissionAnswerResponse] = []
    fields: List[FormFieldResponse] = []

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
