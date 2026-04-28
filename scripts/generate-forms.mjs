/**
 * generate-forms.mjs
 *
 * One-time / repeatable code-generation script.
 *
 * Usage:
 *   node scripts/generate-forms.mjs              # regenerate ALL supported years
 *   node scripts/generate-forms.mjs --year 2027  # add / refresh a single year
 *
 * What it does:
 *   1. For each supported year, reads public/xsl/{year}/ to discover primary
 *      IRS form XSL files (IRS*.xsl, excluding *Style.xsl).
 *   2. Regenerates lib/formRegistry.ts with a FormEntry for every form/year
 *      combination found.  Existing hand-crafted entries (detailed labels,
 *      xmlRootElement overrides) are preserved via the OVERRIDES map.
 *   3. Creates data/forms/{year}/{id}.json stubs for forms that do not yet
 *      have a data file.
 *
 * How to add a future tax year (e.g. TY2027):
 *   1. Copy the full IRS MeF stylesheet package for that year into
 *      public/xsl/2027/  (must include PopulateTemplate.xsl etc.)
 *   2. Copy MEF versioned assets:
 *        cp -r public/mef/rrprd/sdi/versioned/2025 \
 *               public/mef/rrprd/sdi/versioned/2027
 *   3. Run:  node scripts/generate-forms.mjs --year 2027
 *   4. Create data/forms/2027/ stubs are generated automatically.
 *   5. Verify in the dev server — select 2027 in the year dropdown.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const XSL_BASE  = path.join(ROOT, 'public', 'xsl');
const DATA_BASE = path.join(ROOT, 'data', 'forms');
const REGISTRY  = path.join(ROOT, 'lib', 'formRegistry.ts');

// ---------------------------------------------------------------------------
// Which years to process (auto-detected from public/xsl subdirs, or --year arg)
// ---------------------------------------------------------------------------

const yearArg = (() => {
  const idx = process.argv.indexOf('--year');
  return idx !== -1 ? process.argv[idx + 1] : null;
})();

const allYears = yearArg
  ? [yearArg]
  : fs.readdirSync(XSL_BASE)
      .filter(d => /^\d{4}$/.test(d) && fs.statSync(path.join(XSL_BASE, d)).isDirectory())
      .sort();

console.log(`Processing years: ${allYears.join(', ')}`);

// ---------------------------------------------------------------------------
// Per-entry overrides — preserves detailed labels and special fields
// ---------------------------------------------------------------------------

const OVERRIDES = {
  IRS1040: {
    label: 'Form 1040 — U.S. Individual Income Tax Return',
    xsdUrl: '/xsl/2025/IRS1040.xsd',
  },
  IRSW2: {
    label: 'Form W-2 — Wage and Tax Statement',
    xsdUrl: '/xsl/2025/IRSW2.xsd',
  },
  IRS1040ScheduleC: {
    label: 'Schedule C — Profit or Loss from Business',
    xsdUrl: '/xsl/2025/IRS1040ScheduleC.xsd',
  },
  IRS1040ScheduleD: {
    label: 'Schedule D — Capital Gains and Losses',
    xsdUrl: '/xsl/2025/IRS1040ScheduleD.xsd',
  },
  IRS1040ScheduleE: {
    label: 'Schedule E — Supplemental Income and Loss',
    xsdUrl: '/xsl/2025/IRS1040ScheduleE.xsd',
  },
  IRS1120SScheduleK1: {
    label: "Form 1120-S Schedule K-1 — Shareholder's Share of Income",
    xsdUrl: '/xsl/2025/IRS1120SScheduleK1.xsd',
  },
  IRS1065: {
    label: 'Form 1065 — U.S. Return of Partnership Income',
  },
  IRS1065ScheduleK1: {
    label: "Form 1065 Schedule K-1 — Partner's Share of Income",
    xsdUrl: '/xsl/2025/IRS1065ScheduleK1.xsd',
  },
  IRS1040SR: {
    label: 'Form 1040-SR — U.S. Tax Return for Seniors',
    xmlRootElement: 'IRS1040',
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function deriveLabel(id) {
  const ov = OVERRIDES[id];
  if (ov && ov.label) return ov.label;

  let s = id.replace(/^IRS/, '');
  const schedMatch = s.match(/^(\w+?)(Schedule[A-Z0-9].*)$/);
  if (schedMatch) {
    const formNum = schedMatch[1];
    const schedPart = schedMatch[2].replace(/([A-Z])/g, ' $1').trim();
    return `Form ${formNum} ${schedPart}`;
  }
  return `Form ${s}`;
}

function submissionType(id) {
  if (/^IRS1040|^IRSW2|^IRS1099|^IRS499|^IRSRRB|^IRSSSA/.test(id)) return 'Individual';
  if (/^IRS1041/.test(id)) return 'EstateAndTrust';
  if (/^IRS1065/.test(id)) return 'Partnership';
  if (/^IRS1120S/.test(id)) return 'SCorporation';
  if (/^IRS1120/.test(id)) return 'Corporation';
  if (/^IRS990/.test(id))  return 'ExemptOrganization';
  if (/^IRS940|^IRS941|^IRS943|^IRS944|^IRS945/.test(id)) return 'Employment';
  if (/^IRS709|^IRS712/.test(id)) return 'Gift';
  return 'General';
}

function returnTypeCd(id) {
  const m = id.match(/\d+/);
  return m ? m[0] : id.replace(/^IRS/, '');
}

function xsdUrl(id, year) {
  const ov = OVERRIDES[id];
  if (ov && ov.xsdUrl) return ov.xsdUrl;
  const candidate = path.join(XSL_BASE, year, `${id}.xsd`);
  if (fs.existsSync(candidate)) return `/xsl/${year}/${id}.xsd`;
  return null;
}

function buildEntry(id, year) {
  const label    = deriveLabel(id);
  const subType  = submissionType(id);
  const ov       = OVERRIDES[id] || {};
  const xsd      = xsdUrl(id, year);
  const isSR     = id === 'IRS1040SR';
  const docId    = `${id}-DOC-001`;
  const dispName = label.split(' — ')[0].replace(/^Form /, '');

  const xsdLine  = xsd ? `\n    xsdUrl: '${xsd}',` : '';
  const xmlLine  = (ov.xmlRootElement || isSR) ? `\n    xmlRootElement: '${ov.xmlRootElement || 'IRS1040'}',` : '';
  const labelEsc = label.replace(/'/g, "\\'");
  const dispEsc  = dispName.replace(/'/g, "\\'");

  return `  {
    id: '${id}',
    label: '${labelEsc}',
    taxYear: '${year}',
    xslUrl: '/xsl/${year}/${id}.xsl',${xsdLine}${xmlLine}
    appParams: {
      DocumentId: '${docId}',
      Stage: 'original',
      AcceptanceStatus: 'A',
      SubmissionType: '${subType}',
      DisplayName: '${dispEsc}',
    },
    appProps: { SystemMode: 'Test' },
  }`;
}

// ---------------------------------------------------------------------------
// Discover all forms per year
// ---------------------------------------------------------------------------

const allEntries = []; // { id, year, entryStr }

for (const year of allYears) {
  const dir = path.join(XSL_BASE, year);
  if (!fs.existsSync(dir)) {
    console.warn(`  [skip] public/xsl/${year}/ not found`);
    continue;
  }
  const forms = fs.readdirSync(dir)
    .filter(f => f.startsWith('IRS') && f.endsWith('.xsl') && !f.endsWith('Style.xsl'))
    .map(f => f.replace(/\.xsl$/, ''))
    .sort();

  console.log(`  ${year}: ${forms.length} primary forms`);
  for (const id of forms) {
    allEntries.push({ id, year, entryStr: buildEntry(id, year) });
  }
}

// ---------------------------------------------------------------------------
// Write lib/formRegistry.ts
// ---------------------------------------------------------------------------

const entriesBlock = allEntries.map(e => e.entryStr).join(',\n');

const registryContent = `/**
 * formRegistry.ts
 *
 * Central registry of every IRS form the viewer supports.
 * AUTO-GENERATED by scripts/generate-forms.mjs — do not edit by hand.
 * Re-run the script to update after adding new XSL files to public/xsl/{year}/.
 *
 * To add a future tax year:
 *   1. Copy the full IRS MeF XSL package for that year to public/xsl/{year}/
 *   2. Copy MEF assets: cp -r public/mef/rrprd/sdi/versioned/2025 \\
 *                                public/mef/rrprd/sdi/versioned/{year}
 *   3. Run: node scripts/generate-forms.mjs --year {year}
 *
 * Form data (returnHeader + formData) comes from the API at runtime:
 *   GET /api/returns/:submissionId/forms/:formId?year=:taxYear
 */

import type { AppEnvelopeParams, AppProperties } from './genericXmlSerializer';

export interface FormEntry {
  /** XSD root element name — also used as the formId in API calls */
  id: string;
  /** Human-readable label shown in the form selector */
  label: string;
  /** Tax year this entry applies to, e.g. '2025' or '2026' */
  taxYear: string;
  /** Root-relative URL to the main XSL stylesheet */
  xslUrl: string;
  /** Root-relative URL to the XSD schema (optional — for future validation) */
  xsdUrl?: string;
  /**
   * Override the XML root element name used when serializing formData.
   * Useful when a form shares another form's XSL (e.g. 1040-SR uses IRS1040.xsl
   * which expects <IRS1040> in the document). Falls back to \`id\` when omitted.
   */
  xmlRootElement?: string;
  /** AppData/Parameters block */
  appParams: AppEnvelopeParams;
  /** AppData/ApplicationProperties block */
  appProps: AppProperties;
}

export const FORM_REGISTRY: FormEntry[] = [
${entriesBlock},
];
`;

fs.writeFileSync(REGISTRY, registryContent, 'utf8');
console.log(`Wrote lib/formRegistry.ts  (${allEntries.length} entries across ${allYears.length} year(s)).`);

// ---------------------------------------------------------------------------
// Create JSON stubs
// ---------------------------------------------------------------------------

let created = 0;
let skipped = 0;

for (const { id, year } of allEntries) {
  const dir  = path.join(DATA_BASE, year);
  fs.mkdirSync(dir, { recursive: true });
  const dest = path.join(dir, `${id}.json`);
  if (fs.existsSync(dest)) { skipped++; continue; }

  const stub = {
    returnHeader: {
      ReturnTs:           '2026-04-15T10:00:00',
      TaxYr:              year,
      TaxPeriodBeginDt:   `${year}-01-01`,
      TaxPeriodEndDt:     `${year}-12-31`,
      ReturnTypeCd:       returnTypeCd(id),
      SoftwareId:         '11111111',
      SoftwareVersionNum: '01000000',
    },
    formData: {
      documentId: `${id}-DOC-001`,
    },
  };

  fs.writeFileSync(dest, JSON.stringify(stub, null, 2) + '\n', 'utf8');
  created++;
}

console.log(`JSON stubs: ${created} created, ${skipped} already existed.`);
console.log('Done.');
