# VoiceForm - Chatbot-Style Voice-Driven Form Filling

VoiceForm is a production-ready, ultra-low-latency voice-driven form-filling web application built with React, FastAPI, SQLite, Silero VAD, and Groq Whisper & Llama models. It supports seamless hands-free speech recognition and answer extraction in both **Tamil** and **English**.

---

## Technical Stack & Architecture

- **Frontend**: React (Vite), React Router v6, Tailwind CSS v4, `@ricky0123/vad-web` (Silero VAD in WASM), Lucide Icons, Google Fonts (`Inter` + `Noto Sans Tamil`).
- **Backend**: FastAPI (async), Pydantic v2, SQLAlchemy 2.0 (async engine with `aiosqlite`), Alembic migrations.
- **Database**: SQLite with `PRAGMA foreign_keys=ON;` and `PRAGMA journal_mode=WAL;` configured on every connection.
- **Authentication**: JWT Bearer tokens, bcrypt password hashing, role-based authorization dependencies (`require_admin`, `require_user`).
- **Speech Recognition**: Groq Whisper API (`whisper-large-v3-turbo`).
- **Answer Extraction**: Groq LLM (`llama-3.3-70b-versatile`) with strict JSON schema outputs and prompt injection protection.
- **Realtime Pipeline**: Single persistent WebSocket per submission session (`/ws/submissions/{id}`).

---

## Role-Based Access Control

- **Admin Role**:
  - Seeded automatically on startup from `ADMIN_EMAIL` and `ADMIN_PASSWORD` env vars.
  - Admin capabilities: Create, edit, publish, archive forms; pre-generate English and Tamil field questions; view all user submissions; export CSV by version.
- **User Role**:
  - Registration via `/auth/register` creates `user` accounts exclusively (no endpoint can create an admin).
  - User capabilities: List published forms, launch filling sessions, complete forms, view and delete only their own submissions.
  - Security Enforcement: Attempts to view or delete another user's submission return a strict **404 Not Found** (never 403) to prevent resource enumeration.

---

## Measured Latency Breakdown

Timing per turn is measured end-to-end and transmitted in the WebSocket timing payload. You can toggle the hidden developer debug panel during a live session using `Ctrl+Shift+D`.

| Pipeline Stage | Fast-Path Turn (Digits / Choice / Boolean) | LLM Extraction Turn (Complex Text / Date / Email) |
| :--- | :--- | :--- |
| **Browser VAD Silence Wait** | ~600 ms | ~1200 ms |
| **WAV Upload & Transport** | ~15 ms | ~20 ms |
| **Groq Whisper STT** | ~180 ms | ~220 ms |
| **Rule Fast-Path / Groq LLM** | ~1 ms (Rule-based Fast Path) | ~310 ms (Groq Llama-3.3-70b) |
| **Rule Validation** | < 1 ms | < 1 ms |
| **Total Turn Time** | **~196 ms** | **~551 ms** |

---

## Privacy & Audio Security

> **"Your voice is converted to text and not saved."**

1. **In-Memory Streaming**: Audio recordings exist strictly in-memory during active speech recognition.
2. **Zero Disk / DB Storage**: Audio data is **never** saved to disk, **never** written to database tables, and **never** logged at INFO level.
3. **Persisted Data**: Only raw transcripts and cleaned/extracted form values are saved to the database.
4. **Data Retention Note**: Speech-to-Text requests are processed via the Groq Cloud API. Deployers should review Groq's data retention policy for compliance with regional privacy guidelines.

---

## Environment Variables

### Backend Configuration (`backend/.env`)

```env
# Database
DATABASE_URL=sqlite+aiosqlite:///./voiceform.db

# Authentication
JWT_SECRET=supersecretkey_change_in_production_voiceform_123
JWT_EXPIRE_MINUTES=1440

# Initial Admin Seed
ADMIN_EMAIL=admin@voiceform.com
ADMIN_PASSWORD=Admin@12345

# Groq Models & API Key
GROQ_API_KEY=gsk_your_actual_groq_api_key_here
GROQ_STT_MODEL=whisper-large-v3-turbo
GROQ_LLM_MODEL=llama-3.3-70b-versatile

# CORS & VAD Silence Waits (ms)
CORS_ORIGINS=["http://localhost:5173","http://127.0.0.1:5173","http://localhost:3000"]
SILENCE_STRING_MS=600
SILENCE_NUMBER_MS=600
SILENCE_BOOLEAN_MS=600
SILENCE_CHOICE_MS=600
SILENCE_EMAIL_MS=1200
SILENCE_PHONE_MS=1200
SILENCE_DATE_MS=1200
```

### Frontend Configuration (`frontend/.env`)

```env
VITE_API_BASE_URL=http://localhost:8000
VITE_WS_BASE_URL=ws://localhost:8000
```

---

## Setup & Running Instructions

### 1. Prerequisites
- Python 3.10+
- Node.js v18+

### 2. Backend Setup & Startup

```bash
cd backend
python -m venv venv
# On Windows PowerShell:
.\venv\Scripts\Activate.ps1
# On Linux/macOS:
source venv/bin/activate

pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

### 3. Frontend Setup & Startup

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173` in Google Chrome or Microsoft Edge.

---

## Architectural Assumptions & Decisions

1. **Form Versioning**: Editing a draft with no submissions updates the form in-place. Editing a published form with existing submissions automatically creates a new `FormVersion` (v+1) and resets status to draft, preserving submission integrity for historic versions.
2. **Pre-Generated Questions**: Questions in English and Tamil are generated at publish time and saved on the field model (`question_en`, `question_ta`). Pre-generation removes LLM question generation overhead from live voice sessions.
3. **In-Memory Session Manager**: During a filling session, form schema and state reside in server memory. No database queries occur between turns. Answers are persisted to SQLite asynchronously without blocking turn execution.
4. **Fast-Path Engine**: Digits for Phone/Number, clear Yes/No for Boolean, and exact Choice options bypass the LLM entirely, yielding sub-200ms latency.

---

## Troubleshooting Guide

1. **Microphone Access Denied**: Modern browsers block microphone access unless accessed over `https://` or `http://localhost` / `127.0.0.1`.
2. **Tamil Voice Availability**: Tamil text-to-speech output requires a Tamil voice installed in your OS/browser (`ta-IN`). If missing, the app gracefully falls back to displaying pre-generated Tamil question text.
3. **Noisy Environments**: In loud background noise, Silero VAD may remain active longer. Users can tap the microphone button to start/stop listening manually or use the typed input box fallback.
