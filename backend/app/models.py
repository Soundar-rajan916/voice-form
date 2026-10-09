from datetime import datetime
from sqlalchemy import (
    Column, Integer, String, Text, Boolean, DateTime, ForeignKey, JSON, Float
)
from sqlalchemy.orm import relationship
from app.db import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    username = Column(String(255), unique=True, index=True, nullable=True)
    hashed_password = Column(String(255), nullable=False)
    role = Column(String(50), nullable=False, default="user") # "admin" or "user"
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    forms = relationship("Form", back_populates="creator", cascade="all, delete-orphan")
    submissions = relationship("Submission", back_populates="user", cascade="all, delete-orphan")

class Form(Base):
    __tablename__ = "forms"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    status = Column(String(50), nullable=False, default="draft") # "draft", "published", "archived"
    allow_document_upload = Column(Boolean, default=True, nullable=False)
    created_by = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    creator = relationship("User", back_populates="forms")
    versions = relationship("FormVersion", back_populates="form", cascade="all, delete-orphan", order_by="FormVersion.version_number")
    submissions = relationship("Submission", back_populates="form", cascade="all, delete-orphan")

class FormVersion(Base):
    __tablename__ = "form_versions"

    id = Column(Integer, primary_key=True, index=True)
    form_id = Column(Integer, ForeignKey("forms.id", ondelete="CASCADE"), nullable=False)
    version_number = Column(Integer, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    form = relationship("Form", back_populates="versions")
    fields = relationship("FormField", back_populates="form_version", cascade="all, delete-orphan", order_by="FormField.position")
    submissions = relationship("Submission", back_populates="version", cascade="all, delete-orphan")

class FormField(Base):
    __tablename__ = "form_fields"

    id = Column(Integer, primary_key=True, index=True)
    form_version_id = Column(Integer, ForeignKey("form_versions.id", ondelete="CASCADE"), nullable=False)
    field_name = Column(String(255), nullable=False)
    data_type = Column(String(50), nullable=False) # String, Number, Email, Phone, Date, Boolean, Choice
    description = Column(Text, nullable=False)
    required = Column(Boolean, default=True, nullable=False)
    position = Column(Integer, nullable=False, default=0)
    choices = Column(JSON, nullable=True) # list of str for Choice
    question_en = Column(Text, nullable=True)
    question_ta = Column(Text, nullable=True)

    form_version = relationship("FormVersion", back_populates="fields")
    answers = relationship("SubmissionAnswer", back_populates="field", cascade="all, delete-orphan")
    proposals = relationship("SubmissionProposal", back_populates="field", cascade="all, delete-orphan")

class Submission(Base):
    __tablename__ = "submissions"

    id = Column(Integer, primary_key=True, index=True)
    form_id = Column(Integer, ForeignKey("forms.id", ondelete="CASCADE"), nullable=False)
    form_version_id = Column(Integer, ForeignKey("form_versions.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    status = Column(String(50), nullable=False, default="in_progress") # "in_progress", "submitted"
    started_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    completed_at = Column(DateTime, nullable=True)
    submitted_at = Column(DateTime, nullable=True)

    form = relationship("Form", back_populates="submissions")
    version = relationship("FormVersion", back_populates="submissions")
    user = relationship("User", back_populates="submissions")
    answers = relationship("SubmissionAnswer", back_populates="submission", cascade="all, delete-orphan")
    proposals = relationship("SubmissionProposal", back_populates="submission", cascade="all, delete-orphan")

class SubmissionAnswer(Base):
    __tablename__ = "submission_answers"

    id = Column(Integer, primary_key=True, index=True)
    submission_id = Column(Integer, ForeignKey("submissions.id", ondelete="CASCADE"), nullable=False)
    field_id = Column(Integer, ForeignKey("form_fields.id", ondelete="CASCADE"), nullable=False)
    value = Column(Text, nullable=True)
    raw_transcript = Column(Text, nullable=True)
    language = Column(String(10), nullable=True) # "en", "ta", "typed", etc.
    source = Column(String(50), nullable=True) # "voice", "typed", "document"
    evidence = Column(Text, nullable=True) # snippet at most 300 chars
    source_confidence = Column(Float, nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    submission = relationship("Submission", back_populates="answers")
    field = relationship("FormField", back_populates="answers")

class SubmissionProposal(Base):
    __tablename__ = "submission_proposals"

    id = Column(Integer, primary_key=True, index=True)
    submission_id = Column(Integer, ForeignKey("submissions.id", ondelete="CASCADE"), nullable=False)
    field_id = Column(Integer, ForeignKey("form_fields.id", ondelete="CASCADE"), nullable=False)
    value = Column(Text, nullable=False)
    confidence = Column(Float, nullable=False, default=1.0)
    evidence = Column(Text, nullable=True) # exact quote <= 200 chars
    page = Column(Integer, nullable=True)
    read_method = Column(String(50), nullable=False, default="text_layer") # "text_layer" or "vision"
    status = Column(String(50), nullable=False, default="pending") # "pending", "accepted", "dismissed"
    alternatives = Column(JSON, nullable=True) # list of candidate dicts
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    submission = relationship("Submission", back_populates="proposals")
    field = relationship("FormField", back_populates="proposals")
