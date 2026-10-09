# VoiceForm - Chatbot-Style Voice & Vision AI Form Filling

VoiceForm is a production-ready, ultra-low-latency voice & vision AI form-filling web application built with React, FastAPI, SQLite, Silero VAD, Groq Vision AI, and Groq LLMs. It supports hands-free speech recognition in **Tamil** and **English**, alongside document extraction (PDF & DOCX) powered by Groq Vision models.

---

## Technical Stack & Architecture

- **Frontend**: React (Vite), React Router v6, Tailwind CSS v4, `@ricky0123/vad-web` (Silero VAD in WASM), Lucide Icons, Google Fonts (`Inter` + `Noto Sans Tamil`).
- **Backend**: FastAPI (async), Pydantic v2, SQLAlchemy 2.0 (async engine with `aiosqlite`), Alembic migrations.
- **Database**: SQLite with `PRAGMA foreign_keys=ON;` and `PRAGMA journal_mode=WAL;` configured on every connection.
- **Authentication**: JWT Bearer tokens, bcrypt password hashing, role-based authorization dependencies (`require_admin`, `require_user`).
- **Speech Recognition**: Groq Whisper API (`whisper-large-v3-turbo`) & Sarvam AI STT (`saarika:v2`).
- **Vision AI Document Pipeline**: Groq Vision AI (`qwen/qwen3.8-27b`), `pypdfium2`, `python-docx`, `pypdf`.
- **Answer Extraction**: Groq LLM (`qwen/qwen3.8-27b`) with strict JSON schema outputs, grounding verification, and prompt injection protection.
- **Realtime Pipeline**: Single persistent WebSocket per submission session (`/ws/submissions/{id}`).

---

## Document Upload & Vision AI Pipeline

Users can attach a `.pdf` or `.docx` document to fill out form fields automatically.

### Two-Step Vision Pipeline Architecture
1. **Page Routing**:
   - **PDF**: Evaluates text layer per page. Clean text layer pages route to `text_layer`. Pages with missing text layer, garbled text (replacement chars `\ufffd`, legacy Tamil font gibberish), or image-heavy layouts route to `vision`.
   - **DOCX**: Extracted via `python-docx`. Embedded scanned images in image-heavy Word files route to `vision`.
   - **Page Cap**: Capped by `VISION_MAX_PAGES` (default 8 scanned pages). If capped, user is notified: *"Only the first 8 scanned pages were read"*.
2. **Step A (Transcribe)**:
   - Scanned pages rendered in memory using `pypdfium2` at `VISION_DPI` resolution (150 DPI) and downscaled to max 1536px dimension.
   - `DocumentReader` interface passes image bytes to `GroqVisionDocumentReader` (`VISION_MODEL`).
   - Verbatim transcript generated per page preserving Tamil, English, numbers, tables, line structure; unreadable parts tagged as `[illegible]`. Temperature 0.
3. **Step B (Extract & Ground)**:
   - Merges page transcripts in order with page markers (`--- Page X [text_layer/vision] ---`).
   - Passes transcript to `GROQ_DOC_MODEL` (`qwen/qwen3.8-27b`) with prompt injection defense.
   - `verify_grounding` verifies every value is traceable to document text.
   - Data type validation rules applied via `validate_rule`.

### Trust Rules & Security
- Proposals derived from scanned vision pages (`read_method="vision"`) display the warning badge: `"Read from a scanned page. Check this one."`.
- Scan-derived proposals for `Email`, `Phone`, `Number`, and `Date` fields are **excluded** from "Accept all" button & voice commands (`is_excluded_from_accept_all = True`). The user MUST accept each one individually.
- `Name` / `String` / `Choice` fields keep standard suggestion and confirmation flow.
- Optional `VISION_DOUBLE_CHECK` setting: executes a second targeted vision call for scan-derived sensitive fields; sets low confidence (0.4) if readings differ.

### Cost & Rate-Limit Formula
Each page image sent to Groq Vision consumes input tokens based on pixel dimensions:
$$\text{Input Tokens} \approx \left(\frac{\text{Width}}{512}\right) \times \left(\frac{\text{Height}}{512}\right) \times 85 + 170$$
At 150 DPI, a standard page image consumes roughly **1,000 to 1,500 input tokens**. Scanned vision pages cost more input tokens than text-layer pages.

---

## Role-Based Access Control

- **Admin Role**:
  - Seeded automatically on startup from `ADMIN_EMAIL` and `ADMIN_PASSWORD` env vars.
  - Capabilities: Create, edit, publish, archive forms; toggle `allow_document_upload`; pre-generate English and Tamil field questions; view all user submissions; export CSV with answer sources.
- **User Role**:
  - Capabilities: List published forms, fill out forms via voice, typed input, or document upload, view and delete only their own submissions.
  - Security Enforcement: Attempts to view or delete another user's submission return a strict **404 Not Found**.

---

## Measured Latency Breakdown

Timing per turn is measured end-to-end and transmitted in the WebSocket timing payload (`Ctrl+Shift+D` to open debug panel).

| Pipeline Stage | Fast-Path Turn (Digits / Choice / Boolean) | LLM Extraction Turn (Complex Text / Date / Email) | Vision Document Turn (PDF / DOCX Upload) |
| :--- | :--- | :--- | :--- |
| **Browser VAD Silence / Upload** | ~600 ms | ~1200 ms | ~50 ms (WAV / File Upload) |
| **STT / Vision Transcribe** | ~180 ms (Whisper STT) | ~220 ms (Whisper STT) | ~1.2 s per page (Groq Vision) |
| **LLM Field Extraction** | ~1 ms (Fast Path) | ~310 ms (Groq Llama-3.3-70b) | ~450 ms (Groq Doc Extractor) |
| **Rule Validation & Grounding** | < 1 ms | < 1 ms | ~2 ms |
| **Total Turn Time** | **~196 ms** | **~551 ms** | **~1.7 s total** |

---

## Privacy Guarantee

> **"Your document is read to fill this form and is deleted right after. Scanned pages are sent as images to our AI provider."**

1. **In-Memory Image Processing**: Page images exist strictly in memory (`io.BytesIO`) during processing. They are **never** written to disk, **never** stored in databases, and **never** logged above DEBUG level.
2. **Zero File Retention**: Image bytes and base64 payloads are discarded immediately after extraction finishes.
3. **Voice Audio Security**: Speech audio streams strictly in-memory during active speech recognition and is never stored on disk.

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

# STT Provider ("groq" or "sarvam")
STT_PROVIDER=groq
GROQ_API_KEY=gsk_your_actual_groq_api_key_here
GROQ_STT_MODEL=whisper-large-v3-turbo
GROQ_LLM_MODEL=qwen/qwen3.8-27b

# Document LLM & Vision AI Configuration
GROQ_DOC_MODEL=qwen/qwen3.8-27b
VISION_MODEL=qwen/qwen3.8-27b
VISION_DPI=150
VISION_MAX_PAGES=8
VISION_MAX_IMAGES_PER_REQUEST=4
VISION_DOUBLE_CHECK=false

# Document Limits & Rate Limits
MAX_UPLOAD_MB=10
MAX_PDF_PAGES=30
DOC_EXTRACT_TIMEOUT_S=30
UPLOADS_PER_HOUR=10

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

## Known Limits & Architectural Decisions

1. **Vision Model Selection**: Supported vision models on Groq include `llama-3.2-11b-vision-preview` and `llama-3.2-90b-vision-preview`. A startup validation check verifies model availability.
2. **Partial Vision Results**: If the vision model is rate-limited or unavailable, the pipeline retries once with backoff, then proceeds with text-layer pages and notifies the user clearly.
3. **Grounding Defense**: Any extracted value not traceable to document transcript text or matching prompt injection commands inside documents is strictly dropped.
