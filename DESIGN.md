# VoiceForm Design & Architecture Specification

## Design Concept & Philosophy
VoiceForm is designed around a single metaphor: **The Paper Sheet**.
Filling a form should feel like sitting across a counter from a helpful clerk who fills out a paper form in blue ballpoint ink as you speak.
- **The Sheet** is the star of the app: a clean paper surface (`#F3F5F6`) with ruled lines (`#DDE3E6`), a highlighter band (`#FFE45C`) marking the current question, blue ink (`#1F3FBF`) for answers, and a red rotated stamp (`#C2312D`) when submitted.
- **The Conversation** is quiet, printed text beside the Sheet.
- **Strict Light Theme Only**: No dark mode, no gradients, no glows, no glassmorphism, no colored shadows.

---

## Palette & Design Tokens
Defined via CSS Custom Properties in `index.css`:

```css
:root {
  --color-paper: #F3F5F6;       /* The Paper Sheet surface */
  --color-desk: #DDE3E6;        /* Page background & ruled lines */
  --color-charcoal: #2A2D30;    /* Printed text & primary headings */
  --color-charcoal-70: #2A2D30B3; /* Secondary text (70% opacity, >= 4.5:1 contrast) */
  --color-ballpoint: #1F3FBF;   /* User answers, primary actions, focus rings */
  --color-highlighter: #FFE45C; /* Active row highlighter band */
  --color-stamp: #C2312D;       /* Errors & Submitted stamp red */
}
```

---

## Typography System
Self-hosted via `@fontsource` packages:
- **Printed Headings & Chat Questions**: `Literata`, `"Noto Serif Tamil"`, serif.
- **Interface, Buttons, Answers & Inputs**: `"Hind Madurai"`, sans-serif.

### Type Scale (1.25 ratio):
- **14px**: Labels, field metadata, secondary hints
- **17px**: Body text, button labels, input text
- **21px**: Chat questions, answer values on the Sheet
- **26px**: Form titles, section headers
- **33px**: Hero title, main page headers

### Tamil Typography Rules:
- Enlarged 6% relative to Latin text with `line-height: 1.6` minimum to prevent mark clipping.
- Tamil text explicitly wrapped with `lang="ta"`.

---

## Pass 2 Review Report (Anti-Pattern Avoidance)
We explicitly rejected common generic design defaults:
1. **No SaaS Card Kit**: Removed all generic rounded cards, drop shadows, and dark slate backgrounds. Replaced with ruled paper lines and a single clean Desk background.
2. **No Gradients or Glassmorphism**: Removed all CSS gradients, backdrop blurs, and neon glows.
3. **No Decorative Emojis or Icons**: Replaced all decorative emojis (`🎉`, `👋`, `✏️`, `🔒`) with plain, respectful text and simple SVG icons.
4. **No All-Caps Eyebrows**: Sentence case only throughout the interface.

---

## ASCII Layout Wireframes

### 1. Login & Register Screen
```
+-------------------------------------------------------------------------+
| VoiceForm [ Tamil & English ]                              EN | தமிழ்  |
+-------------------------------------------------------------------------+
|                                  |                                      |
|  Sign in to VoiceForm            |  +--------------------------------+  |
|                                  |  | Job Application                |  |
|  Email                           |  | ------------------------------ |  |
|  [                             ] |  | Full name        Soundararajan |  |
|                                  |  | Age              37            |  |
|  Password                        |  | ------------------------------ |  |
|  [                             ] |  | [ Sample Paper Sheet Preview ] |  |
|                                  |  +--------------------------------+  |
|  [ Sign in ]                     |                                      |
|                                  |                                      |
+-------------------------------------------------------------------------+
```

### 2. User Home (Ruled List & Table)
```
+-------------------------------------------------------------------------+
| VoiceForm    Forms   My submissions                       EN | தமிழ்    |
+-------------------------------------------------------------------------+
| Available Voice Forms                                                   |
| ----------------------------------------------------------------------- |
| Patient Intake Form   - General hospital intake form      [ Fill in ]   |
| ----------------------------------------------------------------------- |
| Feedback Survey       - Customer feedback survey          [ Fill in ]   |
| ----------------------------------------------------------------------- |
|                                                                         |
| My Submissions                                                          |
| Title            Version     Started             Status      Action     |
| ----------------------------------------------------------------------- |
| hospital-1       v1          10/08/2026 10:20    Submitted   [ View ]   |
| hospital-2       v1          10/08/2026 11:45    In progress [ Resume ] |
+-------------------------------------------------------------------------+
```

### 3. Voice Form Page (Desktop 1024px+)
```
+-------------------------------------------------------------------------+
| VoiceForm    Forms   My submissions                       EN | தமிழ்    |
+-------------------------------------------------------------------------+
| CONVERSATION COLUMN              | THE SHEET (Paper #F3F5F6)            |
|                                  |                                      |
| What is your email address?      | Job Application Form                 |
| (Serif, large, left Desk rule)   | 3 of 4 answered   =======--------    |
|                                  | ------------------------------------ |
|     soundar@example.com (Blue)   | Full name     Soundararajan    [p]   |
|                                  | Age           25               [p]   |
|                                  | Email         [Highlighter Band] [p] |
| ( mic ) Listening...             | Mobile no                      [p]   |
| [ Type your answer     ] [Send]  | ------------------------------------ |
|                                  | [ Submit form ]                      |
+----------------------------------+--------------------------------------+
```

### 4. Voice Form Page (Mobile 360px)
```
+----------------------------------+
| VoiceForm             EN | தமிழ் |
+----------------------------------+
| What is your email address?      |
|                                  |
|     soundar@example.com          |
|                                  |
| ( mic ) Listening...             |
| [ Type your answer     ] [Send]  |
| -------------------------------- |
| Sheet: 3 of 4 answered   [Open]  |
+----------------------------------+
```

### 5. Admin Form Builder & Preview
```
+-------------------------------------------------------------------------+
| VoiceForm Admin   Forms   Responses                       Log out       |
+-------------------------------------------------------------------------+
| FIELD LIST (Order of questions)  | LIVE SHEET PREVIEW                   |
| 1. full_name (String)      [Edit]| Job Application                      |
| 2. age (Number)            [Edit]| ------------------------------------ |
| 3. email (Email)           [Edit]| Full name                            |
| 4. mobile_no (Phone)       [Edit]| Age                                  |
|                                  | Email                                |
| [+ Add field]                    | Mobile no                            |
+----------------------------------+--------------------------------------+
```

---

## Tamil Translation Dictionary (Needs Native Review)
All user-facing strings are extracted to `src/i18n/ta.js` and `src/i18n/en.js`.
The everyday spoken Tamil strings are listed below for native review:

- `app_name`: "வாய்ஸ்ஃபார்ம்"
- `nav_forms`: "படிவங்கள்"
- `nav_submissions`: "என் பதிவுகள்"
- `review_stage_msg`: "எல்லா கேள்விகளுக்கும் பதிலளிக்கப்பட்டுள்ளது. சரிபார்த்து சமர்ப்பிக்கவும்."
- `submit_btn`: "படிவத்தைச் சமர்ப்பி"
- `submitted_stamp`: "சமர்ப்பிக்கப்பட்டது"
- `mic_tap_to_speak`: "பேச தட்டவும்"
- `mic_listening`: "கேட்கிறது..."
- `mic_blocked`: "மைக் அணுகல் தடுக்கப்பட்டுள்ளது. அமைப்புகளில் அனுமதிக்கவும்."
- `type_placeholder`: "உங்கள் பதிலை டைப் செய்யவும்..."
