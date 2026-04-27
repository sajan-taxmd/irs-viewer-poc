# IRS Form Viewer — Architecture and How It Works

## Overview

The viewer renders IRS e-file forms in the browser using the **official IRS MEF XSL stylesheets** — the same stylesheets the IRS uses internally to display tax forms in the e-file portal. No PDF generation, no custom form rendering code. The form looks exactly like the IRS version because it uses the exact same transformation logic.

---

## The Full Request-to-Render Pipeline

```
User clicks "Load Form"
        │
        ▼
┌─────────────────────────────────────────────────────┐
│  1. API FETCH                                        │
│  FormViewer calls:                                   │
│  GET /api/returns/{submissionId}/forms/{formId}      │
│                                                      │
│  Next.js Route Handler reads                         │
│  data/forms/{formId}.json  →  returns JSON:          │
│  { returnHeader: {...}, formData: {...} }             │
└──────────────────────┬──────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│  2. XML SERIALIZATION                                │
│  buildFormXml() in lib/genericXmlSerializer.ts       │
│                                                      │
│  Combines formData + returnHeader + appParams        │
│  into the IRS AppData XML envelope:                  │
│                                                      │
│  <AppData>                                           │
│    <ApplicationProperties>...</ApplicationProperties>│
│    <Parameters>                                      │
│      <SubmissionVersion>20250</SubmissionVersion>    │
│    </Parameters>                                     │
│    <SubmissionHeaderAndDocument>                     │
│      <ReturnHeader>...</ReturnHeader>                │
│      <SubmissionDocument>                            │
│        <IRS1040 documentId="...">                    │
│          <WagesSalariesAndTipsAmt>87500</...>        │
│          ...                                         │
│        </IRS1040>                                    │
│      </SubmissionDocument>                           │
│    </SubmissionHeaderAndDocument>                    │
│  </AppData>                                          │
└──────────────────────┬──────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│  3. XSL INCLUDE RESOLUTION                           │
│  transformForm() in lib/xslTransform.js              │
│                                                      │
│  Fetches the main XSL (e.g. /xsl/IRS1040.xsl)       │
│  Finds all <xsl:include href="..."/> elements        │
│  Fetches each included file (AddHeader.xsl,          │
│  CommonPathRef.xsl, PopulateTemplate.xsl, etc.)      │
│  Recursively inlines them into one XSL document      │
│                                                      │
│  WHY: The browser's XSLTProcessor cannot follow      │
│  relative hrefs in xsl:include on its own.           │
└──────────────────────┬──────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│  4. XSLT TRANSFORM (browser-native)                  │
│  XSLTProcessor.importStylesheet(resolvedXslDoc)      │
│  XSLTProcessor.transformToDocument(appDataXmlDoc)    │
│                                                      │
│  Input:  AppData XML + fully-inlined XSL             │
│  Output: HTML document (the rendered IRS form)       │
└──────────────────────┬──────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│  5. IFRAME RENDER                                    │
│  The HTML string is written into a sandboxed iframe  │
│  The IRS CSS (from public/mef/.../styles/) and       │
│  JavaScript (FormDisplay.js) load inside the iframe  │
│  The form displays with full IRS styling             │
└─────────────────────────────────────────────────────┘
```

---

## The AppData XML Envelope

The IRS XSL stylesheets do not accept a raw form element like `<IRS1040>` directly. They expect a specific XML wrapper called the **AppData envelope**:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<AppData>
  <ApplicationProperties>
    <SystemMode>Test</SystemMode>
  </ApplicationProperties>
  <Parameters>
    <DocumentId>IRS1040-DOC-001</DocumentId>
    <Stage>original</Stage>
    <SubmissionVersion>20250</SubmissionVersion>   ← drives $TaxYear = 2025
    <AcceptanceStatus>A</AcceptanceStatus>
    <SubmissionType>Individual</SubmissionType>
    <DisplayName>Form 1040</DisplayName>
  </Parameters>
  <SubmissionHeaderAndDocument>
    <ReturnHeader>
      <TaxYr>2025</TaxYr>
      <ReturnTypeCd>1040</ReturnTypeCd>
      <Filer>
        <PrimarySSN>400-00-1040</PrimarySSN>
        ...
      </Filer>
    </ReturnHeader>
    <SubmissionDocument>
      <IRS1040 documentId="IRS1040-DOC-001" softwareId="11111111">
        <WagesSalariesAndTipsAmt>87500</WagesSalariesAndTipsAmt>
        ...
      </IRS1040>
    </SubmissionDocument>
  </SubmissionHeaderAndDocument>
</AppData>
```

The `SubmissionVersion` field is critical: `CommonPathRef.xsl` extracts the first 4 characters (`2025`) as `$TaxYear` to build the versioned CSS/image/script URLs:
- `/mef/rrprd/sdi/versioned/2025/styles/`
- `/mef/rrprd/sdi/versioned/2025/scripts/`
- `/mef/rrprd/sdi/versioned/2025/images/`

---

## XSL Include / Import Chain

Each main form stylesheet references several shared helpers via `xsl:include` or `xsl:import`.

```
IRS1040.xsl / IRS1065.xsl / IRSW2.xsl / IRS1040Schedule*.xsl
├── xsl:include → CommonPathRef.xsl     (URL params: $TaxYear, $CSSPath, $ImagePath)
├── xsl:include → AddHeader.xsl          (taxpayer name / address / SSN header)
├── xsl:include → AddOnTable.xsl         (overflow/add-on table at bottom)
├── xsl:include → PopulateTemplate.xsl   (named templates for field population)
└── xsl:include → <Form>Style.xsl        (form-specific CSS rules)

IRS1065ScheduleK1.xsl / IRS1120SScheduleK1.xsl   ← K-1 stylesheets
├── xsl:IMPORT  → PopulateTemplate.xsl   (IMPORT not include — see note below)
├── xsl:include → CommonPathRef.xsl
├── xsl:include → AddHeader.xsl
├── xsl:include → AddOnTable.xsl
└── xsl:include → <Form>Style.xsl
```

### xsl:import vs xsl:include

The IRS K-1 stylesheets use `xsl:import` instead of `xsl:include` for `PopulateTemplate.xsl`. In standard XSLT, `xsl:import` gives the imported templates lower precedence (the importing stylesheet's templates win on conflict). In practice, the K-1 stylesheets only *call* templates from `PopulateTemplate.xsl` without overriding them, so precedence doesn't matter for rendering.

The critical issue: the browser's `XSLTProcessor` cannot follow a relative `href` on either `xsl:import` or `xsl:include` when the stylesheet was loaded as text and re-parsed (the parsed document has no base URL). `xslTransform.js` resolves **both** directives by fetching and splicing inline before handing the merged stylesheet to `XSLTProcessor`.

`xslTransform.js` resolves both directive types by walking direct children of `<xsl:stylesheet>` in document order and inlining them. Every included/imported file is fetched from `public/xsl/` (same origin) and spliced inline. This is why all XSL files must be **flat siblings** in `public/xsl/` — relative paths like `href="AddHeader.xsl"` only work when both files are in the same directory.

---

## JSON-to-XML Serialization Rules

`lib/genericXmlSerializer.ts` converts a plain JavaScript object into XML elements following these rules:

| JavaScript value | XML output |
|---|---|
| `"string"` or `42` or `true` | `<Tag>value</Tag>` |
| `{ key: val }` (object) | `<Tag><key>val</key></Tag>` (recursive) |
| `[item1, item2]` (array) | `<Tag>item1</Tag><Tag>item2</Tag>` (repeated elements) |
| `null`, `undefined`, `""` | omitted |
| Keys in `IRS_ROOT_ATTRS` set | XML attribute on root element (e.g. `documentId`, `softwareId`) |

**Example:**
```javascript
// Input:
{ documentId: "IRS1040-DOC-001", WagesSalariesAndTipsAmt: 87500 }

// Output:
<IRS1040 documentId="IRS1040-DOC-001">
  <WagesSalariesAndTipsAmt>87500</WagesSalariesAndTipsAmt>
</IRS1040>
```

**Array example (repeating elements):**
```javascript
// Input:
{ DependentDetail: [
  { DependentFirstNm: "Emily", DependentRelationshipCd: "DAUGHTER" },
  { DependentFirstNm: "Shelly", DependentRelationshipCd: "SON" }
]}

// Output:
<DependentDetail>
  <DependentFirstNm>Emily</DependentFirstNm>
  <DependentRelationshipCd>DAUGHTER</DependentRelationshipCd>
</DependentDetail>
<DependentDetail>
  <DependentFirstNm>Shelly</DependentFirstNm>
  <DependentRelationshipCd>SON</DependentRelationshipCd>
</DependentDetail>
```

Field names must match XSD element names exactly. The XSD files in `public/xsl/*.xsd` are the authoritative reference for field names.

---

## Why the XSL Transform is Browser-Only

`XSLTProcessor` and `DOMParser` (used to parse XSL and XML strings) are browser APIs with no Node.js equivalent. Running them server-side in Next.js would throw `ReferenceError: XSLTProcessor is not defined`.

The solution is a two-layer import pattern:

```
app/page.tsx  (Server Component)
    └── components/FormViewerShell.tsx  ("use client")
            └── dynamic(() => import('./FormViewer'), { ssr: false })
                    └── components/FormViewer.tsx  ("use client")
                            └── import lib/xslTransform.js  (browser-only)
```

`ssr: false` tells Next.js: "do not attempt to render this component on the server during static generation or SSR." `ssr: false` is only allowed inside a Client Component (not a Server Component), which is why `FormViewerShell.tsx` exists as the intermediary.

---

## Form Registry Design

`lib/formRegistry.ts` holds **only static metadata** — no tax data:

```typescript
interface FormEntry {
  id: string;          // XSD root element name — also the formId in API calls
  label: string;       // shown in the dropdown
  xslUrl: string;      // fetched at render time
  xsdUrl?: string;     // optional — for future validation
  appParams: AppEnvelopeParams;  // Parameters block values
  appProps: AppProperties;       // ApplicationProperties values
}
```

Tax-specific data (`returnHeader`, `formData`) is **never stored in the registry**. It comes from the API at runtime. This means:

- The registry is a deploy-time concern (which forms exist)
- The data is a runtime concern (what data to show)
- You can render the same form multiple times with different data by changing the Submission ID

---

## Mock API vs Real API

In mock mode the Route Handler ignores `submissionId` and reads a static JSON file:

```typescript
// app/api/returns/[submissionId]/forms/[formId]/route.ts
const filePath = path.join(process.cwd(), 'data', 'forms', `${formId}.json`);
const raw = await fs.readFile(filePath, 'utf-8');
return NextResponse.json(JSON.parse(raw));
```

To connect a real backend, change **one line** in `lib/api/formDataService.ts`:

```typescript
// Before (mock):
const url = `/api/returns/${submissionId}/forms/${formId}`;

// After (real API):
const url = `https://your-api.example.com/returns/${submissionId}/forms/${formId}`;
```

The response shape must stay the same: `{ returnHeader: {...}, formData: {...} }`. The serializer, XSL engine, and UI are all unchanged.

---

## Asset Paths and `$TaxYear`

`CommonPathRef.xsl` derives `$TaxYear` from the `SubmissionVersion` parameter:

```xsl
<xsl:param name="TaxYear"
  select="substring(/AppData/Parameters/SubmissionVersion, 1, 4)" />
```

With `SubmissionVersion = "20250"`, `$TaxYear = "2025"`. The stylesheet then builds versioned asset URLs:

```xsl
<xsl:param name="CSSPath">
  /mef/rrprd/sdi/versioned/2025/styles
</xsl:param>
<xsl:param name="ScriptPath">
  /mef/rrprd/sdi/versioned/2025/scripts
</xsl:param>
<xsl:param name="ImagePath">
  /mef/rrprd/sdi/versioned/2025/images
</xsl:param>
<xsl:param name="NonVersionedImagePath">
  /mef/rrprd/common/images
</xsl:param>
```

All these paths are served from `public/` in the Next.js project. A quirk in `FormDisplay.js` references `/mef/rrdprd/common/images/` (extra `d`) instead of `/mef/rrprd/common/images/`. Both paths are served by creating a mirror directory.

---

## Sequence Diagram

```
Browser                    Next.js Server              public/ (static)
   │                            │                           │
   │── GET /                    │                           │
   │◄── page.tsx (SSR shell)    │                           │
   │                            │                           │
   │  [user clicks Load Form]   │                           │
   │                            │                           │
   │── GET /api/returns/        │                           │
   │   DEMO-001/forms/IRS1040 ──►                           │
   │◄── { returnHeader,         │                           │
   │      formData } JSON       │                           │
   │                            │                           │
   │  buildFormXml()            │                           │
   │  (in browser)              │                           │
   │                            │                           │
   │── GET /xsl/IRS1040.xsl ────────────────────────────────►
   │◄── XSL text ───────────────────────────────────────────│
   │── GET /xsl/CommonPathRef.xsl ──────────────────────────►
   │◄── XSL text ───────────────────────────────────────────│
   │── GET /xsl/AddHeader.xsl ──────────────────────────────►
   │◄── (... 4 more includes resolved) ─────────────────────│
   │                            │                           │
   │  XSLTProcessor.transform() │                           │
   │  → HTML string             │                           │
   │                            │                           │
   │  iframe.contentDocument    │                           │
   │  .write(html)              │                           │
   │                            │                           │
   │── GET /mef/.../body.css ───────────────────────────────►
   │── GET /mef/.../FormDisplay.js ─────────────────────────►
   │◄── IRS form rendered ──────────────────────────────────│
```
