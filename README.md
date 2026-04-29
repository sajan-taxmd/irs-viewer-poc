# IRS Form Viewer

A Next.js (App Router) browser-based viewer for official IRS e-file forms. Select a tax year and form, enter a Submission ID, and the app fetches the form data from an API, serializes it to the IRS MEF XML envelope, and renders it using the official IRS XSL stylesheets — exactly as it would appear in an IRS e-file portal.

---

## Quick Start

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Supported Tax Years and Forms

The viewer currently supports **447 forms across two tax years**:

| Tax Year | Forms | Coverage |
|---|---|---|
| **TY 2025** | 421 | Full program-year package — individual, business, partnership, corporate, payroll, exempt organization, and more |
| **TY 2026** | 26 | Quarterly and excise forms: 941, 720, 8849 schedules, 8038-CP, 941-X, etc. |

The UI shows a **"TY XXXX"** year dropdown in the toolbar. Switching years updates the form list automatically.

---

## Mock Mode and Sample Submission IDs

The app runs in **mock mode** — any Submission ID you type works; the API ignores it and returns the stored sample data for the selected form. The 9 forms below have rich mock data (real-looking names, amounts, and addresses). All other forms load with a minimal stub that renders the blank form layout.

| Form | ID | Sample Submission ID | Mock data |
|---|---|---|---|
| Form 1040 — U.S. Individual Income Tax Return | `IRS1040` | `DEMO-001` | John Smith, Springfield IL |
| Form 1040-SR — U.S. Tax Return for Seniors | `IRS1040SR` | `DEMO-001` | Robert & Margaret Johnson, Scottsdale AZ (retired) |
| Form W-2 — Wage and Tax Statement | `IRSW2` | `DEMO-W2-001` | John Smith @ Acme Corporation, Chicago IL |
| Schedule C — Profit or Loss from Business | `IRS1040ScheduleC` | `DEMO-SCHC-001` | Smith Consulting LLC, $125,000 gross receipts |
| Schedule D — Capital Gains and Losses | `IRS1040ScheduleD` | `DEMO-SCHD-001` | Stock sales (Apple, Google, Vanguard ETF) |
| Schedule E — Supplemental Income and Loss | `IRS1040ScheduleE` | `DEMO-SCHE-001` | Rental property + ABC Partners LLC pass-through |
| Form 1120-S Schedule K-1 | `IRS1120SScheduleK1` | `DEMO-K1S-001` | Tech Ventures S-Corp, 35% ownership |
| Form 1065 — U.S. Return of Partnership Income | `IRS1065` | `DEMO-1065-001` | ABC Partners LLC, Dallas TX |
| Form 1065 Schedule K-1 | `IRS1065ScheduleK1` | `DEMO-K1P-001` | John Smith, 33.33% GP interest in ABC Partners |

> For all other forms, use any Submission ID (e.g. `DEMO-001`). The form renders with blank fields.

---

## How to Load a Form

1. Run `npm run dev` and open `http://localhost:3000`
2. Select a **tax year** from the "TY XXXX" dropdown
3. Select a **form** from the form dropdown
4. Type any Submission ID (e.g. `DEMO-001`) in the text field
5. Click **Load Form** or press Enter
6. The rendered IRS form appears in the iframe below the toolbar

---

## Project Structure

```
irs-viewer/
├── app/
│   ├── page.tsx                              Entry page (Server Component)
│   ├── layout.tsx
│   └── api/
│       ├── forms/route.ts                    GET /api/forms
│       └── returns/[submissionId]/
│           └── forms/[formId]/route.ts       GET /api/returns/:id/forms/:formId?year=:year
│
├── components/
│   ├── FormViewer.tsx                        Main UI: year + form dropdowns, iframe
│   └── FormViewerShell.tsx                   SSR-safe wrapper (ssr: false)
│
├── lib/
│   ├── formRegistry.ts                       447 form entries (auto-generated)
│   ├── genericXmlSerializer.ts               JSON → AppData XML (year-aware)
│   ├── xslTransform.js                       XSL transform (browser XSLTProcessor)
│   └── api/formDataService.ts                API fetch wrapper (passes year param)
│
├── data/forms/
│   ├── 2025/                                 421 JSON files (9 rich, 412 stubs)
│   │   ├── IRS1040.json
│   │   ├── IRSW2.json
│   │   └── ...
│   └── 2026/                                 26 JSON stubs for quarterly forms
│       ├── IRS941.json
│       └── ...
│
├── public/
│   ├── xsl/
│   │   ├── 2025/                             1,965 files — full IRS MEF TY2025 package
│   │   │   ├── IRS1040.xsl
│   │   │   ├── IRS1040Style.xsl
│   │   │   ├── PopulateTemplate.xsl
│   │   │   └── ...
│   │   └── 2026/                             83 files — quarterly/excise forms
│   │       ├── IRS941.xsl
│   │       └── ...
│   └── mef/rrprd/sdi/versioned/
│       ├── 2025/                             IRS CSS, JavaScript, images (TY2025)
│       └── 2026/                             Copy of 2025 assets (no official 2026 release yet)
│
└── scripts/
    └── generate-forms.mjs                    Code-generation script (see below)
```

---

## API Endpoints

### `GET /api/forms`
Returns all registered forms:
```json
[
  { "id": "IRS1040", "label": "Form 1040 — U.S. Individual Income Tax Return" },
  ...
]
```

### `GET /api/returns/:submissionId/forms/:formId?year=2025`
Returns form data for rendering. The `year` query parameter selects which year's mock data to load (defaults to `2025`):
```json
{
  "returnHeader": { "TaxYr": "2025", "ReturnTypeCd": "1040", "Filer": { "..." } },
  "formData": { "WagesSalariesAndTipsAmt": 87500, "..." }
}
```

---

## Connecting a Real Backend

All API logic is isolated in `lib/api/formDataService.ts`. Change the URL template to point at your real backend:

```typescript
// lib/api/formDataService.ts
const url = `https://your-api.example.com/returns/${submissionId}/forms/${formId}?year=${taxYear}`;
```

The response shape must match:
```typescript
{
  returnHeader: Record<string, unknown>;  // IRS ReturnHeader fields
  formData: Record<string, unknown>;      // Form-specific field values
}
```

Field names must exactly match the XSD element names (e.g. `WagesSalariesAndTipsAmt`, `EIN`). See `data/forms/2025/IRS1040.json` for a detailed reference.

---

## Adding a Future Tax Year

When the IRS releases a new program year package (e.g. TY2027):

### Step 1 — Obtain the full stylesheet package

Download the complete XSL stylesheet distribution from the IRS MeF partner portal (e.g. `PY2028R1/mef/Stylesheets/2027/`). It must be the **full release**, not a mid-year update. Confirm it contains `PopulateTemplate.xsl`, `CommonPathRef.xsl`, `AddHeader.xsl`, and `AddOnTable.xsl`.

### Step 2 — Copy XSL files

```bash
cp /path/to/PY2028R1/mef/Stylesheets/2027/*.xsl \
   public/xsl/2027/
```

### Step 3 — Copy MEF versioned assets

```bash
cp -r public/mef/rrprd/sdi/versioned/2025 \
      public/mef/rrprd/sdi/versioned/2027
```

If the IRS distributes updated CSS/JS/images for the new year, use those instead.

### Step 4 — Run the generation script

```bash
node scripts/generate-forms.mjs --year 2027
```

This scans `public/xsl/2027/` and automatically:
- Appends new entries (with `taxYear: '2027'`) to `lib/formRegistry.ts`
- Creates stub JSON files under `data/forms/2027/`

### Step 5 — Verify

Start the dev server and select `TY 2027` in the year dropdown. Load a form to confirm it renders.

### Step 6 — Enrich mock data (optional)

Stub files contain only a `documentId`. Edit `data/forms/2027/{formId}.json` to add real-looking field values, following the pattern in `data/forms/2025/IRS1040.json`.

---

## Why TY2023 and TY2024 Are Not Supported

The IRS publishes two types of stylesheet releases:

- **Full program-year package** — every form stylesheet for that year (required to support a year in this viewer)
- **Mid-year update package** — only the forms that changed since the last release

The 2023 and 2024 folders available in this distribution are update packages. They are missing:

1. **Incomplete form coverage** — 2023 has 34 forms, 2024 has 46. Hundreds of forms for those years have no XSL and cannot render.
2. **No MEF versioned assets** — CSS, JavaScript, and images are only available for 2025. Rendered forms for other years would be unstyled and non-functional.
3. **No XSD schemas** — only the 2025v5.2 schema distribution is included.

To add TY2023 or TY2024 in the future, obtain the **full** TY2023/TY2024 XSL package and MEF versioned assets from the IRS MeF partner portal, then follow the steps above.

---

## How the Rendering Pipeline Works

```
User selects year + form
       │
       ▼
fetchFormData(submissionId, formId, taxYear)
  GET /api/returns/{id}/forms/{formId}?year={taxYear}
  → reads data/forms/{taxYear}/{formId}.json
       │
       ▼
buildFormXml(rootElement, formData, appParams, appProps, returnHeader, taxYear)
  → AppData XML string with <SubmissionVersion>{taxYear}0</SubmissionVersion>
       │
       ▼
transformForm(xmlString, '/xsl/{taxYear}/{formId}.xsl')
  → fetches XSL, recursively inlines all xsl:include directives
  → runs browser XSLTProcessor
  → returns HTML string
       │
       ▼
iframe.contentDocument.write(html)
  → HTML loads CSS/JS from /mef/rrprd/sdi/versioned/{taxYear}/
```

`CommonPathRef.xsl` extracts `$TaxYear` from `SubmissionVersion` (first 4 characters) and uses it to build all CSS/image/script paths — so setting the correct `SubmissionVersion` is what makes the correct versioned assets load.

---

## XSL File Layout

Each year's stylesheets are in `public/xsl/{year}/` as flat siblings. This is required because IRS XSL files use `xsl:include` with bare filenames (`<xsl:include href="AddHeader.xsl"/>`). The browser's `XSLTProcessor` cannot resolve relative includes from re-parsed text — `lib/xslTransform.js` fetches and inlines them recursively at transform time.

| File pattern | Role |
|---|---|
| `CommonPathRef.xsl` | Defines `$TaxYear`, CSS/image/script URL params |
| `AddHeader.xsl` | Renders form header (name, address, SSN/EIN) |
| `AddOnTable.xsl` | Renders the overflow continuation table |
| `PopulateTemplate.xsl` | Named templates for individual field population |
| `IRS{form}.xsl` | Primary stylesheet for each form |
| `IRS{form}Style.xsl` | CSS definitions for that form |
| `*Statement.xsl`, `*Schedule.xsl` | Shared supplemental document renderers |

---

## Technology

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack) |
| Styling | Tailwind CSS v4 |
| XML serialization | Custom (`lib/genericXmlSerializer.ts`) |
| XSL transform | Browser `XSLTProcessor` API (`lib/xslTransform.js`) |
| Form stylesheets | IRS MEF official XSL packages (TY2025 full, TY2026 quarterly) |
| Mock API | Next.js Route Handlers (`app/api/`) |
| Code generation | `scripts/generate-forms.mjs` (Node.js, no dependencies) |