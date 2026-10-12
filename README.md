# Citizen Desk (குடிமக்கள் சேவை மையம்) — Voice-First Citizen Form-Filling Assistant

Citizen Desk is a bilingual (Tamil & English) voice-driven form-filling web application designed for citizen welfare and public service applications (e.g., certificates, scholarships, pensions). 

Citizens can complete forms conversationally—answering one question at a time using voice audio or typing—while a live ledger panel updates answers in real-time. Built with **React 19**, **FastAPI**, **SQLite**, **Silero VAD**, **Groq/Sarvam Speech STT**, and **Groq LLMs**.

> [!IMPORTANT]
> **APPLICATION HELPER NOTICE**:
> **This is an application helper demonstration and not an official government portal.**
> It assists citizens in completing and reviewing application forms. It does not submit directly to any government registry or use official state seals or emblems.

---

## Key Features

- **Voice-First Conversational Interface**:
  - Voice Activity Detection (Silero VAD) with automatic turn-taking and speech silence detection.
  - Text-to-Speech (TTS) reads out questions in spoken Tamil or English.
  - Supports speech recognition via Groq Whisper, Sarvam AI, or browser Web Speech API.
  - Conversational fallbacks: Users can type, correct, skip, or edit any field at any time.

- **Dynamic Live Sheet**:
  - Live side-panel sheet displays all answers in real-time as the citizen speaks or types.
  - Direct navigation: Click any field on the sheet to review or update the answer.

- **Document Vision Extraction**:
  - Upload documents or photos to auto-extract applicant information using Vision LLMs.

- **Admin Form Builder & Versioning**:
  - Admins can design custom forms with dynamic field types: String, Number, Date, Phone, Choice.
  - Semantic field configuration with auto-generated bilingual prompts (English and Tamil).
  - Form version isolation: Existing submissions remain safely locked to the form version they were started on.
  - Form lifecycle management: Draft, Published, and Archived states.

- **Native Excel Export (`.xlsx`)**:
  - Formatted multi-sheet Excel spreadsheet export powered by `openpyxl`.
  - **Sheet 1 (`Submissions`)**: Overview table of all completed applications with applicant emails, completion dates, and all answered form columns.
  - **Sheet 2 (`Answers Ledger`)**: Granular audit ledger with raw transcripts, source channel, and language.
  - In-progress submissions are automatically excluded from exports.

- **Privacy & Sensitive Data Protection**:
  - Sensitive number fields (e.g., identity or financial fields) can be flagged for encryption.
  - Encrypted at rest using Fernet symmetric encryption (`FERNET_KEY`).
  - Masked in the UI (`•••• 1234`) and excluded from transcripts and standard exports.
  - Configurable data retention policy with automated background cleanup.

---

## Tech Stack

| Layer | Technology |
| :--- | :--- |
| **Frontend** | React 19, Vite, Tailwind CSS v4, Lucide React, Silero VAD Web |
| **Backend** | FastAPI, Python 3.11+, SQLAlchemy (asyncio / aiosqlite), Pydantic v2 |
| **Database** | SQLite with Alembic migrations |
| **Spreadsheets**| `openpyxl` for styled Excel workbook generation |
| **AI / Speech** | Groq Whisper / Sarvam AI (STT), Groq Llama 3 (LLM Extraction & Vision) |
| **Testing** | pytest (Backend - 56 tests), Vitest & Testing Library (Frontend - 14 tests) |

---

## Getting Started

### Prerequisites
- **Node.js** (v18+)
- **Python** (v3.11+)
- **Git**

---

### 1. Backend Setup

```bash
cd backend

# Create and activate virtual environment (Windows PowerShell)
python -m venv venv
.\venv\Scripts\Activate.ps1

# Install dependencies
pip install -r requirements.txt

# Run backend test suite (56 tests)
pytest

# Start the FastAPI server with auto-reload
uvicorn app.main:app --reload --port 8000
```

The API will be operational at `http://127.0.0.1:8000`.  
Interactive API docs are available at `http://127.0.0.1:8000/docs`.

---

### 2. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Run frontend test suite (14 tests)
npm test

# Start Vite development server
npm run dev
```

Open `http://localhost:5173` in your browser.

---

## Default Demo Credentials

On initial startup, sample citizen service forms and demo users are seeded automatically:

| Role | Email | Password | Access |
| :--- | :--- | :--- | :--- |
| **Administrator** | `admin@voiceform.com` | `Admin@12345` | Form Builder, Submissions Ledger, Excel Export |
| **Citizen** | `citizen@example.com` | `Citizen@12345` | Browse Services, Voice Form Filling, Live Review |

---

## Environment Configuration

Create a `.env` file in `backend/` to configure optional AI providers:

```env
# Server & Security
APP_NAME="Citizen Desk"
OFFICE_NAME="Citizen Service Centre"
JWT_SECRET="your-secure-jwt-secret"
FERNET_KEY="your-fernet-encryption-key-32b="
RETENTION_DAYS=30

# Speech-to-Text & LLM (Optional)
GROQ_API_KEY="gsk_..."
GROQ_LLM_MODEL="llama-3.3-70b-versatile"
GROQ_STT_MODEL="whisper-large-v3"

# Sarvam AI STT (Alternative Tamil STT)
SARVAM_API_KEY=""
```

*Note: If no API keys are configured, the system falls back to browser-native Web Speech API and rule-based extraction.*
