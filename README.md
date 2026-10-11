# Citizen Desk (குடிமக்கள் சேவை மையம்) — Tamil-First Citizen Application Helper

Citizen Desk is a bilingual (Tamil-first and English) application helper for citizen services such as certificates, scholarships, and pensions, used by citizens at a self-service touchscreen kiosk (`/kiosk`) or by help-desk operators on their behalf (`/desk`). Built with React, FastAPI, SQLite, Silero VAD, Groq/Sarvam Speech STT, and Groq LLMs.

> [!IMPORTANT]
> **NON-GOAL & STRICT HONESTY NOTICE**:
> **This is an application helper and not an official government portal.**
> The application produces a completed citizen application with a non-sequential reference number for the service office to process. It does **NOT** submit directly to any real government portal, and it must never claim to. It uses no government emblems, state seals, or official logos. All branding and office nomenclature are configured via brand settings (`appName` default "Citizen Desk", `officeName` default "Citizen Service Centre").

> [!WARNING]
> **SECURITY & DATA PROTECTION NOTICE**:
> This software handles citizen personal information for demonstration and office-intake workflows. Before production deployment in a live public kiosk or help-desk, it requires:
> 1. Comprehensive legal and data protection impact assessment (DPDP Act compliance).
> 2. Database volume encryption at rest and secure key management (HSM/KMS).
> 3. Enforced TLS certificates and hardened kiosk hardware lock-down.
> 4. Physical printer supervision and strict retention audit compliance.

---

## Roles and Channels

- **Administrator (`admin`)**: Manages forms, versions, field builder, operator accounts, and kiosk device accounts; revokes kiosks or operators; reviews audit trail ledgers; triggers manual data retention purges; views all citizen applications.
- **Help-Desk Operator (`operator`)**: Assists citizens at the counter (`/desk`), records consent ("Applicant informed and agrees"), fills by voice or typing, captures/uploads documents, monitors kiosks needing help, and conducts reference number lookups for their assisted applications.
- **Kiosk Device (`kiosk`)**: Hardware device account representing a walk-up kiosk terminal (`/kiosk`). Can only read published service forms, spawn single 20-minute scoped application sessions, and signal staff help requests.
- **Citizen (`user`)**: Self-service online citizen accounts.

### Channels Recorded
Each application records its origination channel:
- `self_service`: Citizen completed directly at a kiosk terminal.
- `assisted`: Completed with help-desk operator assistance (`assisted_by` recorded).
- `online`: Standard citizen portal submission.

---

## Kiosk Mode (`/kiosk`)

Touchscreen-optimized full-screen interface (landscape and portrait):
1. **Language Choice**: Two massive touch targets (தமிழ் and English).
2. **Service Selection**: Large cards displaying published citizen service forms.
3. **Privacy Notice & Consent**: Large plain-language explanation with recorded consent timestamp.
4. **Voice & Typed Filling**: Large microphone controls, audio question reading aloud, and an on-screen Tamil virtual keyboard with Unicode tap grid (vowels, consonants, grantha letters ஜ ஷ ஸ ஹ க்ஷ, vowel signs, and pulli ்) alongside English QWERTY.
5. **Review & Corrections**: Ruled sheet displaying answers in pen-blue.
6. **Submit & Print**: Instant 80mm thermal receipt slip preview with reference number in boxed character cells, QR code, and office details.
7. **Zero-Trace Wipe**: Complete client and server wipe on finish, start over, or 60-second idle timeout (15s countdown modal). React state wiped, WebSocket closed, camera streams and object URLs revoked, autocomplete cleared, browser history replaced (no back navigation), and HTTP `Cache-Control: no-store` enforced.

### Silent Kiosk Printing
For dedicated kiosks equipped with 80mm thermal receipt printers:
```bash
# Launch Chrome/Chromium in kiosk printing mode to bypass print dialog:
chrome.exe --kiosk --kiosk-printing http://localhost:5173/kiosk
```

---

## Sensitive Number Fields Protection

Form builder supports a **"Sensitive number"** flag (auto-suggested on keywords like Aadhaar, PAN, voter ID, ration card, bank account, passport):
- **Typed-only input**: Voice audio transcription and document vision extraction are strictly disabled for flagged fields.
- **Masked on screen**: Masked as `•••• •••• 1234` after entry (only last 4 characters visible).
- **Encrypted at rest**: Encrypted using Fernet symmetric encryption with key from environment (`FERNET_KEY`).
- **Log and Export protection**: Never logged in console or transcripts; excluded from standard CSV exports unless explicitly requested by administrator.
- *The default seed forms contain no identity or banking number fields.*

---

## Reference Numbers & Retention

- **Reference Number Format**: `CS-YYMMDD-XXXXXXXX` (e.g., `CS-261011-7K3M9QX2`). Non-sequential Crockford Base32 alphabet with check character. Validation is verified mathematically before lookups.
- **Boxed Character Cells**: Deliberate nod to paper application forms (one character per cell).
- **Automated Retention**: Submissions are automatically purged after `RETENTION_DAYS` (default 30 days) via daily background worker and server startup sweep, with full audit logging.

---

## Tamil Translation Review List (Needs Native Review)

The everyday spoken Tamil translations in `frontend/src/i18n/ta.js` require native speaker review before public kiosk deployment:

| Translation Key | Tamil String | English Meaning / Context |
| :--- | :--- | :--- |
| `disclaimer` | `இது ஒரு விண்ணப்ப உதவி தளம் மட்டுமே, அதிகாரப்பூர்வ அரசு இணையதளம் அல்ல.` | This is an application helper and not an official government portal. |
| `privacy_notice` | `உங்கள் குரல் உரையூட்டலுக்காக எமது பேச்சு சேவைக்கு அனுப்பப்படும். ஆவணங்கள் மற்றும் புகைப்படங்கள் படிவத்தை நிரப்ப மட்டுமே பயன்படுத்தப்பட்டு உடனடியாக நீக்கப்படும். உங்கள் விண்ணப்பம் {days} நாட்களுக்கு பாதுகாக்கப்படும்.` | Voice is converted to text. Docs are used to fill and deleted immediately. Application is kept for {days} days. |
| `btn_agree` | `ஒப்புக்கொள்கிறேன்` | I agree (Consent) |
| `idle_warning` | `நீங்கள் இன்னும் இருக்கிறீர்களா?` | Are you still there? (Idle prompt) |
| `call_staff` | `அலுவலர் உதவி` | Call staff / Officer help |
| `stamp_received` | `பெறப்பட்டது` | Received stamp text |
| `sample_badge` | `மாதிரி படிவம், துறைசார் படிவத்திற்கு ஏற்ப மாற்றவும்` | Sample template, adapt to department form |
| `slip_keep` | `இந்த ரசீதை உங்கள் விண்ணப்ப நிலையை அறிய பத்திரமாக வைத்திருக்கவும்.` | Keep this slip to check your application status. |

---

## Running the Application

### 1. Backend Setup
```bash
cd backend
.\venv\Scripts\Activate.ps1
pytest   # Run 58 tests (all passing)
uvicorn app.main:app --reload --port 8000
```

### 2. Frontend Setup
```bash
cd frontend
npm install
npm run build
npm run dev
```

Open `http://localhost:5173` to access CareVoice.
