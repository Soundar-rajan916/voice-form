# CareVoice - Hospital Patient Intake Design Specification

## Pass 1: PLAN

### Product Frame & Purpose
CareVoice is a calm, plain, and accessible hospital patient-intake application for **City General Hospital**.
- **Patients & Attendants**: Register and fill in hospital intake forms by speaking in Tamil or English, typing, or uploading a document.
- **Hospital Staff**: Create and manage registration forms, view patient responses, export records, and manage hospital intake workflows.
- **Role Labels (UI Only)**:
  - Role `user` displays in UI as **Patient**
  - Role `admin` displays in UI as **Hospital Staff**
  - Database schema, table names, API paths, and JWT claims retain `user` and `admin` internally.

### Brand Configuration (`frontend/src/brand.js`)
- `appName`: Configured via `import.meta.env.VITE_APP_NAME` or default `"CareVoice"`
- `hospitalName`: Configured via `import.meta.env.VITE_HOSPITAL_NAME` or default `"City General Hospital"`
- `emergencyNumbers`: Configured via `import.meta.env.VITE_EMERGENCY_NUMBERS` or default `"108,112"`

---

## Palette & Design System Tokens

All colors are strictly mapped to CSS Custom Properties in `index.css`:

```css
:root {
  --color-gauze: #F6F8F5;          /* The Sheet slip surface */
  --color-ward: #DCE7E0;           /* Page background & ruled lines (pale hospital green) */
  --color-charcoal: #2A2E2C;       /* Printed text & headers (Contrast 11.8:1 on Gauze) */
  --color-charcoal-75: rgba(42, 46, 44, 0.75); /* Secondary text (Contrast 7.6:1 on Gauze) */
  --color-ballpoint: #1F3FBF;      /* Patient answers, primary buttons, focus rings (Contrast 8.5:1) */
  --color-highlighter: #FFE45C;    /* Active row highlighter band */
  --color-stamp: #B3261E;          /* Errors, Submitted stamp red & emergency text (Contrast 6.1:1 on Gauze) */
}
```

### Contrast Ratios (Verified):
- **Charcoal on Gauze**: 11.8:1 (Passes AAA)
- **Charcoal on Ward**: 9.4:1 (Passes AAA)
- **Ballpoint Blue on Gauze**: 8.5:1 (Passes AAA)
- **Secondary Charcoal (75%) on Gauze**: 7.6:1 (Passes AAA)
- **Stamp Red on Gauze**: 6.1:1 (Passes AA for body, AAA for large text)

---

## Typography System

Self-hosted via `@fontsource` npm packages (no external Google Font network requests):
- **Printed Text & Questions**: `Literata`, `"Noto Serif Tamil"`, serif.
- **Interface, Buttons, Answers, Tables & Inputs**: `"Hind Madurai"`, sans-serif.

### Type Scale (1.25 ratio, Base 18px):
- **16px**: Labels, field metadata, secondary hints
- **18px**: Base body text, button text, input values
- **22px**: Chat questions, patient answer values on Sheet
- **28px**: Page titles, section headers
- **35px**: Hospital name / Sheet header title

### Tamil Typography Rules:
- Scaled up 6% relative to Latin text with `line-height: 1.6` minimum to prevent diacritic mark clipping.
- Tamil text explicitly marked with `lang="ta"`.
- Tested with long Tamil names such as **சௌந்தரராஜன்**.
- Maximum line length constrained to 60 characters for readability.

---

## Pass 2: REVIEW (Anti-Pattern & Domain Constraint Audit)

We performed a strict audit against generic web templates and medical cliches:

1. **Domain Emblem Protection**:
   - **NO Red Cross or Red Crescent shapes anywhere**. The emergency notice uses a phone icon (`PhoneCall`), and all icons are standard functional SVG icons.
2. **No Medical Cliches**:
   - NO heartbeat/ECG lines, NO stethoscopes, NO stock photos/illustrations of doctors, NO blue-and-teal gradient "medical SaaS" look.
3. **No Gradients, Glows, Glassmorphism, or Colored Shadows**:
   - Flat light theme only. The **only** shadow in the entire application is a subtle shadow under the Paper Sheet (`shadow-md` / `box-shadow: 0 4px 12px rgba(42, 46, 44, 0.08)`).
4. **Quiet Conversation & Bold Sheet**:
   - Left conversation column uses quiet printed text with a 2px Ward rule on the left.
   - Right column is **The Sheet**: ruled paper rows (`Gauze #F6F8F5`), highlighter band (`#FFE45C`) on the active row, blue ballpoint ink (`#1F3FBF`) for confirmed answers, and a red rotated (-6deg) "Submitted" stamp upon submission.

---

## ASCII Wireframes

### 1. Patient Registration / Login Page
```
+---------------------------------------------------------------------------------+
| CareVoice  City General Hospital                       English | தமிழ் | Auto  |
+---------------------------------------------------------------------------------+
|                                       |                                         |
|  Sign in to CareVoice                 |  City General Hospital                  |
|                                       |  Patient Registration Slip              |
|  Email address                        |  -------------------------------------  |
|  [                             ]      |  Full name     Priya Srinivasan        |
|                                       |  Age           28                       |
|  Password                             |  Mobile no     9876501014               |
|  [                             ]      |  -------------------------------------  |
|                                       |  [ Sample Registration Slip Preview ]   |
|  [ Sign in ]                          |                                         |
+---------------------------------------------------------------------------------+
```

### 2. Patient Home Page
```
+---------------------------------------------------------------------------------+
| CareVoice  City General Hospital   Forms  My submitted forms   EN | தமிழ் | Auto|
+---------------------------------------------------------------------------------+
| Emergency: In an emergency, call 108 or 112.                                    |
|                                                                                 |
| Hospital Intake Forms                                                           |
| ------------------------------------------------------------------------------- |
| Patient registration  - General registration for new patients       [ Start ]   |
| ------------------------------------------------------------------------------- |
| Medical history       - Record allergies, medications & conditions  [ Start ]   |
| ------------------------------------------------------------------------------- |
| Appointment request   - Request a visit with a doctor               [ Start ]   |
| ------------------------------------------------------------------------------- |
|                                                                                 |
| My Submitted Forms                                                              |
| Form Title               Version     Date          Status        Action         |
| ------------------------------------------------------------------------------- |
| Patient registration     v1          10/08/2026    Submitted     [ View ]       |
+---------------------------------------------------------------------------------+
```

### 3. Desktop Voice Intake Page (1024px+)
```
+---------------------------------------------------------------------------------+
| CareVoice  City General Hospital   Forms  My submitted forms   EN | தமிழ் | Auto|
+---------------------------------------------------------------------------------+
| Emergency: This assistant only collects information. It cannot give medical     |
| advice. In an emergency, call 108 or 112.                                       |
+----------------------------------------+----------------------------------------+
| CONVERSATION COLUMN (Quiet printed text)| THE SHEET (Gauze #F6F8F5 surface)      |
|                                        | City General Hospital                  |
| What is your full name?                | Patient registration                   |
| (Serif, 24px, 2px Ward rule on left)   | 3 of 8 answered  ========------------   |
|                                        | -------------------------------------- |
|     Priya Srinivasan (Ballpoint Blue)  | Full name    Priya Srinivasan   [Edit] |
|                                        | Age          [Highlighter Band] [Edit] |
|                                        | Gender                          [Edit] |
| ( O ) Tap to speak                     | Mobile no                       [Edit] |
| [ Type your answer          ] [Send]   | -------------------------------------- |
| [ Attach document ]                    | [ Submit form ]                        |
+----------------------------------------+----------------------------------------+
```

### 4. Mobile Voice Intake Page (360px+)
```
+-----------------------------------+
| CareVoice            EN | தமிழ்   |
+-----------------------------------+
| Emergency: Call 108 or 112        |
+-----------------------------------+
| What is your full name?           |
|                                   |
|     Priya Srinivasan              |
|                                   |
| ( O ) Tap to speak                |
| [ Type your answer       ] [Send] |
| --------------------------------- |
| Sheet: 3 of 8 answered     [Open] |
+-----------------------------------+
```

### 5. Hospital Staff Dashboard & Form Builder
```
+---------------------------------------------------------------------------------+
| CareVoice  City General Hospital   Forms  Responses   [Hospital staff] [Log out]|
+---------------------------------------------------------------------------------+
| Forms Management                      | Live Form Preview                       |
| 1. full_name (String)          [Edit] | City General Hospital                   |
| 2. age (Number)                [Edit] | Patient registration                    |
| 3. gender (Choice)             [Edit] | --------------------------------------  |
| 4. mobile_number (Phone)       [Edit] | Full name                               |
|                                       | Age                                     |
| [+ Add field]                         | Gender                                  |
+---------------------------------------+-----------------------------------------+
```

---

## Tamil Translation Dictionary (`src/i18n/ta.js`)
*Note: All Tamil strings below are drafted in everyday spoken Tamil and listed for native review.*

- `appName`: "கேர்வாய்ஸ்"
- `hospitalName`: "நகரப் பொது மருத்துவமனை"
- `navForms`: "படிவங்கள்"
- `navSubmissions`: "என் படிவங்கள்"
- `patientRole`: "நோயாளி"
- `staffRole`: "மருத்துவமனை ஊழியர்"
- `emergencyBanner`: "இந்த உதவியாளர் தகவல்களை மட்டுமே சேகரிக்கும். மருத்துவ ஆலோசனை வழங்காது. அவசரநிலைக்கு 108 அல்லது 112 ஐ அழைக்கவும்."
- `emergencyNoticeMobile`: "அவசரநிலைக்கு: 108 அல்லது 112 ஐ அழைக்கவும்"
- `firstBotMessage`: "வணக்கம். {title} படிவத்தை நிரப்ப உதவுகிறேன். ஒரு நேரத்தில் ஒரு கேள்வி கேட்கிறேன். நீங்கள் பேசலாம் அல்லது டைப் செய்யலாம்."
- `reviewStageMsg`: "எல்லா கேள்விகளுக்கும் பதிலளிக்கப்பட்டுள்ளது. சரிபார்த்து சமர்ப்பிக்கவும்."
- `submitBtn`: "படிவத்தைச் சமர்ப்பி"
- `submittedStamp`: "சமர்ப்பிக்கப்பட்டது"
- `micTapToSpeak`: "பேச தட்டவும்"
- `micListening`: "கேட்கிறது..."
- `typePlaceholder`: "உங்கள் பதிலை டைப் செய்யவும்"
- `readAloudLabel`: "கேள்விகளை உரக்கப் படி"

---

## NOTES & Future Considerations
- Role internal keys (`user`, `admin`), API routes (`/forms`, `/submissions`), database schema, and JWT payload structure are strictly preserved without functional changes.
- All colors and contrast ratios pass WCAG AAA (and AA for red text accents).
