# IRS Multi-Form Viewer — Implementation Plan

> This document records the implementation plan as designed and executed.
> All todos were completed on 2026-04-27.

---

## Overview

Build an IRS form viewer in Next.js 13+ (App Router) — API Route Handlers serve mock form data as JSON, a client-side FormViewer component fetches it on demand and renders each form via XSL transform in an iframe.

---

## Design Decisions

### Why Next.js (App Router) over Vite + Express

| Concern | Vite approach | Next.js App Router |
|---------|-------------|-------------------|
| Mock API | Separate Express server + proxy config | Route Handlers in `app/api/` — same project, same origin, no proxy |
| Static XSL/CSS | `public/` (same) | `public/` (same) |
| Client-only XSL transform | Works | Works with `"use client"` + `dynamic(..., {ssr:false})` |
| Real API swap | Change `formDataService.ts` URL | Same — just change the fetch URL |

### Why API-driven (no hardcoded formData)

The original `IRS1040_Viewer` project hardcoded all form data in `formRegistry.ts`. The new design separates concerns:

- **Registry** = deploy-time metadata (which forms exist, where their XSL lives)
- **API** = runtime data (what taxpayer data to display)

This allows the same viewer to render any taxpayer's return by changing the Submission ID, and to connect to a real backend with a one-line change.

### Why flat `public/xsl/`

All IRS XSL stylesheets use relative `xsl:include` paths like `<xsl:include href="AddHeader.xsl"/>`. The browser's `XSLTProcessor` cannot resolve these itself. `xslTransform.js` fetches and inlines them recursively. For the relative paths to resolve, all XSL files must be siblings in the same directory.

### Why `ssr: false` requires a Client Component wrapper

Next.js 16 (Turbopack) does not allow `dynamic(..., { ssr: false })` inside Server Components. `FormViewerShell.tsx` is a `"use client"` wrapper that holds the `dynamic()` call, while `app/page.tsx` remains a Server Component.

---

## Completed Tasks

| Task | What was done |
|------|--------------|
| Scaffold Next.js project | `create-next-app` at `PY2026R1/irs-viewer/` with TypeScript, Tailwind, App Router |
| Move existing XSL | Copied `IRS1040_Viewer/xsl/*` → `public/xsl/` |
| Copy new form XSLs | Copied 14 form XSLs + updated 4 shared helpers from `/home/sajan/irs/PY2026R1 (1)/PY2026R9/mef/Stylesheets/2025/` |
| Copy XSD files | Copied 7 XSD schemas from `1040x_2025v5.2` (W-2, Sch C/D/E) and `efile1040x_2014v5.1` (K-1s) |
| Create mock JSON data | 8 JSON files in `data/forms/` with realistic `returnHeader` + `formData` |
| API Route Handlers | `GET /api/forms` and `GET /api/returns/[id]/forms/[formId]` |
| lib/ files | Ported `genericXmlSerializer.ts`, `xslTransform.js`; new `formRegistry.ts` (no formData); new `formDataService.ts` |
| FormViewer component | `"use client"` component with Tailwind toolbar, submissionId input, iframe render |
| SSR-safe page | `FormViewerShell.tsx` (`"use client"` + `dynamic ssr:false`) + `app/page.tsx` (Server Component) |
| Fix: Turbopack config | Removed empty `webpack()` override; added `turbopack: {}` to `next.config.ts` |
| Fix: `ssr:false` in Server Component | Moved `dynamic()` call from `page.tsx` into `FormViewerShell.tsx` (`"use client"`) |
| Fix: `rrdprd` image paths | `FormDisplay.js` has a hardcoded typo path; mirrored images to `/public/mef/rrdprd/common/images/` |
| Fix: Tailwind v4 class names | Updated `flex-shrink-0` → `shrink-0`, `bg-gradient-to-r` → `bg-linear-to-r` |

---

## Final Project Structure

```
irs-viewer/
├── app/
│   ├── layout.tsx
│   ├── page.tsx                   Server Component
│   └── api/
│       ├── forms/route.ts         GET /api/forms
│       └── returns/[submissionId]/forms/[formId]/route.ts
│
├── components/
│   ├── FormViewer.tsx             "use client" — full UI
│   └── FormViewerShell.tsx        "use client" — ssr:false wrapper
│
├── lib/
│   ├── formRegistry.ts            8 forms (static metadata only)
│   ├── genericXmlSerializer.ts    JSON → AppData XML
│   ├── xslTransform.js            XSLTProcessor wrapper
│   └── api/formDataService.ts     fetch(/api/returns/...)
│
├── data/forms/
│   ├── IRS1040.json
│   ├── IRSW2.json
│   ├── IRS1040ScheduleC.json
│   ├── IRS1040ScheduleD.json
│   ├── IRS1040ScheduleE.json
│   ├── IRS1120SScheduleK1.json
│   ├── IRS1065.json
│   └── IRS1065ScheduleK1.json
│
├── public/
│   ├── xsl/               22 XSL files + 8 XSD files
│   └── mef/               CSS, JS, images (versioned 2025 + common)
│
└── docs/
    ├── ARCHITECTURE.md    (this system explained in depth)
    └── PLAN.md            (this file)
```

---

## XSL and XSD Source Files

### XSL source: `/home/sajan/irs/PY2026R1 (1)/PY2026R9/mef/Stylesheets/2025/`

| File copied | Form |
|---|---|
| `IRS1040.xsl`, `IRS1040Style.xsl` | Already in IRS1040_Viewer — moved to `public/xsl/` |
| `IRS1040SR.xsl`, `IRS1040SRStyle.xsl` | Senior variant (included by IRS1040.xsl) |
| `IRSW2.xsl`, `IRSW2Style.xsl` | Form W-2 |
| `IRS1040ScheduleC.xsl`, `IRS1040ScheduleCStyle.xsl` | Schedule C |
| `IRS1040ScheduleD.xsl`, `IRS1040ScheduleDStyle.xsl` | Schedule D |
| `IRS1040ScheduleE.xsl`, `IRS1040ScheduleEStyle.xsl` | Schedule E |
| `IRS1120SScheduleK1.xsl`, `IRS1120SScheduleK1Style.xsl` | S-Corp K-1 |
| `IRS1065.xsl`, `IRS1065Style.xsl` | Form 1065 |
| `IRS1065ScheduleK1.xsl`, `IRS1065ScheduleK1Style.xsl` | Partnership K-1 |
| `AddHeader.xsl` | Shared header helper (2025 version) |
| `AddOnTable.xsl` | Shared add-on table helper (2025 version) |
| `CommonPathRef.xsl` | Shared URL/path parameters (2025 version) |
| `PopulateTemplate.xsl` | Shared field population templates (2025 version) |

### XSD source: `1040x_2025v5.2` and `efile1040x_2014v5.1`

| File | Source |
|---|---|
| `IRS1040.xsd` | Already in IRS1040_Viewer |
| `IRSW2.xsd` | `1040x_2025v5.2/.../IndividualIncomeTax/Common/IRSW2/IRSW2.xsd` |
| `IRS1040ScheduleC.xsd` | `1040x_2025v5.2/.../Common/IRS1040ScheduleC/IRS1040ScheduleC.xsd` |
| `IRS1040ScheduleD.xsd` | `1040x_2025v5.2/.../Common/IRS1040ScheduleD/IRS1040ScheduleD.xsd` |
| `IRS1040ScheduleE.xsd` | `1040x_2025v5.2/.../Common/IRS1040ScheduleE/IRS1040ScheduleE.xsd` |
| `IRS1120SScheduleK1.xsd` | `efile1040x_2014v5.1/.../Corp1120S/IRS1120SScheduleK1/IRS1120SScheduleK1.xsd` |
| `IRS1065ScheduleK1.xsd` | `efile1040x_2014v5.1/.../Part1065/IRS1065ScheduleK1/IRS1065ScheduleK1.xsd` |

---

## Issues Encountered and Fixes

### 1. Turbopack + webpack config conflict (Next.js 16)
**Error:** `This build is using Turbopack, with a webpack config and no turbopack config.`  
**Fix:** Replaced `webpack(config) { return config; }` with `turbopack: {}` in `next.config.ts`.

### 2. `ssr: false` not allowed in Server Components (Next.js 16 + Turbopack)
**Error:** `` `ssr: false` is not allowed with `next/dynamic` in Server Components ``  
**Fix:** Created `components/FormViewerShell.tsx` as a `"use client"` component that holds the `dynamic()` call. `app/page.tsx` renders `<FormViewerShell />` and stays a Server Component.

### 3. `rrdprd` vs `rrprd` typo in FormDisplay.js
**Issue:** `FormDisplay.js` (from the original IRS package) references `/mef/rrdprd/common/images/` but the actual directory is `/mef/rrprd/common/images/`.  
**Fix:** Created `/public/mef/rrdprd/common/images/` as a mirror with the same images. Both paths now resolve.

### 4. Tailwind v4 deprecated class names
**Warnings:** `flex-shrink-0` → `shrink-0`, `bg-gradient-to-r` → `bg-linear-to-r`  
**Fix:** Applied sed replacement across `FormViewer.tsx`.

### 5. `xsl:import` not resolved for K-1 stylesheets → XSLTProcessor returns null
**Forms affected:** `IRS1065ScheduleK1`, `IRS1120SScheduleK1`  
**Root cause:** Both K-1 stylesheets use `xsl:import href="PopulateTemplate.xsl"` instead of `xsl:include`. The original `resolveIncludes()` function only scanned for `xsl:include` via `getElementsByTagNameNS(XSL_NS, 'include')`. The `xsl:import` directive was left unresolved; the browser's `XSLTProcessor` could not follow the relative href from a re-parsed document (no base URL), causing it to silently return null.  
**Fix:** Rewrote `resolveIncludes()` to walk all direct children of `<xsl:stylesheet>` and process both `localName === 'include'` and `localName === 'import'` identically — fetch, recursively resolve, splice children inline, remove the directive.
