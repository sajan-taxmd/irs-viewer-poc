# IRS Form Viewer

A Next.js (App Router) browser-based viewer for official IRS e-file forms. Select a form, enter a Submission ID, and the app fetches the form data from an API, serializes it to the IRS MEF XML envelope, and renders it using the official IRS XSL stylesheets — exactly as it would appear in an IRS e-file portal.

---

## Quick Start

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Supported Forms and Submission IDs

The app currently runs in **mock mode** — `submissionId` is a free-form label you type into the toolbar input. Any value works; the mock API ignores it and always returns the stored sample data for the selected form.

| Form Selector Label | Form ID (internal) | Sample Submission ID to try | Taxpayer / Entity in mock data |
|---|---|---|---|
| Form 1040 — U.S. Individual Income Tax Return | `IRS1040` | `DEMO-001` | John Smith, SSN 400-00-1040, Springfield IL |
| Form W-2 — Wage and Tax Statement | `IRSW2` | `DEMO-W2-001` | John Smith @ Acme Corporation, Chicago IL |
| Schedule C — Profit or Loss from Business | `IRS1040ScheduleC` | `DEMO-SCHC-001` | Smith Consulting LLC, $125,000 gross receipts |
| Schedule D — Capital Gains and Losses | `IRS1040ScheduleD` | `DEMO-SCHD-001` | Stock sales (Apple, Google, Vanguard ETF) |
| Schedule E — Supplemental Income and Loss | `IRS1040ScheduleE` | `DEMO-SCHE-001` | Rental property + ABC Partners LLC pass-through |
| Form 1120-S Schedule K-1 — Shareholder's Share | `IRS1120SScheduleK1` | `DEMO-K1S-001` | Tech Ventures S-Corp, 35% ownership |
| Form 1065 — U.S. Return of Partnership Income | `IRS1065` | `DEMO-1065-001` | ABC Partners LLC, Dallas TX, EIN 12-3456789 |
| Form 1065 Schedule K-1 — Partner's Share | `IRS1065ScheduleK1` | `DEMO-K1P-001` | John Smith, 33.33% GP interest in ABC Partners |

> **Note:** In mock mode any Submission ID string works (e.g. `DEMO-001`, `TEST`, `12345`). The Submission ID field becomes meaningful when you wire in a real backend — see [Connecting a Real API](#connecting-a-real-api) below.

---

## How to Load a Form

1. Run `npm run dev`
2. Open `http://localhost:3000`
3. Choose a form from the dropdown
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
│           └── forms/[formId]/route.ts       GET /api/returns/:id/forms/:formId
│
├── components/
│   ├── FormViewer.tsx                        Main UI ("use client")
│   └── FormViewerShell.tsx                   SSR-safe wrapper
│
├── lib/
│   ├── formRegistry.ts                       Registered forms (static metadata)
│   ├── genericXmlSerializer.ts               JSON → AppData XML
│   ├── xslTransform.js                       XSL transform (browser-only)
│   └── api/formDataService.ts                API fetch wrapper
│
├── data/forms/
│   ├── IRS1040.json                          Mock data for Form 1040
│   ├── IRSW2.json                            Mock data for W-2
│   ├── IRS1040ScheduleC.json
│   ├── IRS1040ScheduleD.json
│   ├── IRS1040ScheduleE.json
│   ├── IRS1120SScheduleK1.json
│   ├── IRS1065.json
│   └── IRS1065ScheduleK1.json
│
├── public/
│   ├── xsl/                                  IRS MEF 2025 XSL stylesheets + XSDs
│   └── mef/rrprd/sdi/versioned/2025/         IRS CSS, JavaScript, images
│
└── docs/
    ├── ARCHITECTURE.md                       How the system works (detailed)
    └── PLAN.md                               Implementation plan
```

---

## API Endpoints

### `GET /api/forms`
Returns the list of all registered forms:
```json
[
  { "id": "IRS1040", "label": "Form 1040 — U.S. Individual Income Tax Return" },
  ...
]
```

### `GET /api/returns/:submissionId/forms/:formId`
Returns form data for rendering:
```json
{
  "returnHeader": { "TaxYr": "2025", "ReturnTypeCd": "1040", "Filer": { ... } },
  "formData": { "WagesSalariesAndTipsAmt": 87500, ... }
}
```

---

## Connecting a Real API

All API logic is isolated in one file: `lib/api/formDataService.ts`.

Change the URL template to point at your real backend:

```typescript
// lib/api/formDataService.ts
const url = `https://your-api.example.com/returns/${submissionId}/forms/${formId}`;
```

The response shape must match:
```typescript
{
  returnHeader: Record<string, unknown>;  // IRS ReturnHeader fields
  formData: Record<string, unknown>;      // Form-specific field values
}
```

Field names must match the XSD element names exactly (e.g. `WagesSalariesAndTipsAmt`, `EIN`, `PartnerSSN`). See the existing JSON files in `data/forms/` for reference shapes.

---

## Adding a New Form

1. Copy the form's `*.xsl`, `*Style.xsl`, and `*.xsd` files into `public/xsl/`
   - Source: IRS MEF Stylesheets package (e.g. `PY2026R9/mef/Stylesheets/2025/`)
2. Create `data/forms/<FormId>.json` with sample `returnHeader` and `formData`
3. Add one entry to `lib/formRegistry.ts`:

```typescript
{
  id: 'IRS1041',
  label: 'Form 1041 — U.S. Income Tax Return for Estates and Trusts',
  xslUrl: '/xsl/IRS1041.xsl',
  xsdUrl: '/xsl/IRS1041.xsd',
  appParams: {
    DocumentId: 'IRS1041-DOC-001',
    Stage: 'original',
    AcceptanceStatus: 'A',
    SubmissionType: 'Fiduciary',
    DisplayName: 'Form 1041',
  },
  appProps: { SystemMode: 'Test' },
},
```

The new form automatically appears in the dropdown — no other code changes needed.

---

## XSL Files in `public/xsl/`

All XSL files are **flat siblings** in one directory. This is required because the IRS XSL stylesheets use `xsl:include` with relative paths (e.g. `<xsl:include href="AddHeader.xsl"/>`). The browser's `XSLTProcessor` cannot resolve relative includes itself — `xslTransform.js` fetches and inlines them recursively at runtime.

| File | Role |
|------|------|
| `CommonPathRef.xsl` | Defines `$TaxYear`, CSS/image/script URL parameters |
| `AddHeader.xsl` | Renders the form header (taxpayer name, address, SSN) |
| `AddOnTable.xsl` | Renders the add-on (overflow) table at the bottom |
| `PopulateTemplate.xsl` | Named templates for populating individual fields |
| `IRS1040.xsl` | Form 1040 main stylesheet |
| `IRS1040Style.xsl` | Form 1040 CSS definitions |
| `IRSW2.xsl` / `IRSW2Style.xsl` | W-2 stylesheet + styles |
| `IRS1040ScheduleC/D/E.xsl` | Schedule stylesheets |
| `IRS1120SScheduleK1.xsl` | S-Corp K-1 stylesheet |
| `IRS1065.xsl` / `IRS1065ScheduleK1.xsl` | Partnership return + K-1 |

XSL source: IRS MEF PY2026R1 package, `Stylesheets/2025/` folder.

---

## Technology

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router, Turbopack) |
| Styling | Tailwind CSS v4 |
| XML serialization | Custom (`lib/genericXmlSerializer.ts`) |
| XSL transform | Browser `XSLTProcessor` API (`lib/xslTransform.js`) |
| Form stylesheets | IRS MEF 2025 official XSL package |
| Mock API | Next.js Route Handlers (`app/api/`) |
