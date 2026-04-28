/**
 * generate-forms.mjs
 *
 * One-time code-generation script.
 *
 * Usage:
 *   node scripts/generate-forms.mjs
 *
 * What it does:
 *   1. Reads public/xsl/ to discover all primary IRS form XSL files
 *      (IRS*.xsl, excluding *Style.xsl).
 *   2. Regenerates lib/formRegistry.ts with an entry for every form found.
 *      Existing 9 detailed-label entries are preserved; new entries get
 *      auto-generated labels and minimal appParams.
 *   3. Creates data/forms/{id}.json stubs for every form that does not
 *      already have a JSON file.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const XSL_DIR  = path.join(ROOT, 'public', 'xsl');
const DATA_DIR = path.join(ROOT, 'data', 'forms');
const REGISTRY = path.join(ROOT, 'lib', 'formRegistry.ts');

// ---------------------------------------------------------------------------
// 1. Discover primary form XSL files
// ---------------------------------------------------------------------------

const allXsl = fs.readdirSync(XSL_DIR).filter(f => f.endsWith('.xsl'));
const primaryForms = allXsl
  .filter(f => f.startsWith('IRS') && !f.endsWith('Style.xsl'))
  .map(f => f.replace(/\.xsl$/, ''))
  .sort();

console.log(`Found ${primaryForms.length} primary IRS form XSL files.`);

// ---------------------------------------------------------------------------
// 2. Helper utilities
// ---------------------------------------------------------------------------

/** Derive a human-readable label from an XSL stem like IRS1041ScheduleK1 */
function deriveLabel(id) {
  // Known overrides for the 9 existing forms (kept verbatim)
  const KNOWN = {
    IRS1040:             'Form 1040 — U.S. Individual Income Tax Return',
    IRSW2:               'Form W-2 — Wage and Tax Statement',
    IRS1040ScheduleC:    'Schedule C — Profit or Loss from Business',
    IRS1040ScheduleD:    'Schedule D — Capital Gains and Losses',
    IRS1040ScheduleE:    'Schedule E — Supplemental Income and Loss',
    IRS1120SScheduleK1:  "Form 1120-S Schedule K-1 — Shareholder's Share of Income",
    IRS1065:             'Form 1065 — U.S. Return of Partnership Income',
    IRS1065ScheduleK1:   "Form 1065 Schedule K-1 — Partner's Share of Income",
    IRS1040SR:           'Form 1040-SR — U.S. Tax Return for Seniors',
  };
  if (KNOWN[id]) return KNOWN[id];

  // Strip leading "IRS"
  let s = id.replace(/^IRS/, '');

  // Split off any "ScheduleXX" suffix
  const schedMatch = s.match(/^(\w+?)(Schedule[A-Z0-9].*)$/);
  if (schedMatch) {
    const formNum = schedMatch[1];
    const schedPart = schedMatch[2].replace(/([A-Z])/g, ' $1').trim();
    return `Form ${formNum} ${schedPart}`;
  }

  // Handle plain form numbers — add "Form " prefix
  return `Form ${s}`;
}

/** Derive SubmissionType from form id */
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

/** Return ReturnTypeCd from form id (digits only, for returnHeader) */
function returnTypeCd(id) {
  const m = id.match(/\d+/);
  return m ? m[0] : id.replace(/^IRS/, '');
}

/** Check whether an XSD exists for this form in public/xsl/ */
function xsdExists(id) {
  return fs.existsSync(path.join(XSL_DIR, `${id}.xsd`));
}

// ---------------------------------------------------------------------------
// 3. Build registry entries string
// ---------------------------------------------------------------------------

function buildEntry(id) {
  const label    = deriveLabel(id);
  const subType  = submissionType(id);
  const hasSd    = xsdExists(id);
  const isSR     = id === 'IRS1040SR';
  const docId    = `${id}-DOC-001`;
  const dispName = label.split(' — ')[0].replace(/^Form /, '');

  const xsdLine  = hasSd ? `\n    xsdUrl: '/xsl/${id}.xsd',` : '';
  const xmlLine  = isSR  ? `\n    xmlRootElement: 'IRS1040',` : '';
  const labelEsc = label.replace(/'/g, "\\'");

  return `  {
    id: '${id}',
    label: '${labelEsc}',
    xslUrl: '/xsl/${id}.xsl',${xsdLine}${xmlLine}
    appParams: {
      DocumentId: '${docId}',
      Stage: 'original',
      AcceptanceStatus: 'A',
      SubmissionType: '${subType}',
      DisplayName: '${dispName.replace(/'/g, "\\'")}',
    },
    appProps: { SystemMode: 'Test' },
  }`;
}

const entriesBlock = primaryForms.map(buildEntry).join(',\n');

// ---------------------------------------------------------------------------
// 4. Write lib/formRegistry.ts
// ---------------------------------------------------------------------------

const registryContent = `/**
 * formRegistry.ts
 *
 * Central registry of every IRS form the viewer supports.
 * AUTO-GENERATED by scripts/generate-forms.mjs — do not edit by hand.
 * Re-run the script to update after adding new XSL files to public/xsl/.
 *
 * Form data (returnHeader + formData) comes from the API at runtime:
 *   GET /api/returns/:submissionId/forms/:formId
 */

import type { AppEnvelopeParams, AppProperties } from './genericXmlSerializer';

export interface FormEntry {
  /** XSD root element name — also used as the formId in API calls */
  id: string;
  /** Human-readable label shown in the form selector */
  label: string;
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
console.log(`Wrote lib/formRegistry.ts  (${primaryForms.length} entries).`);

// ---------------------------------------------------------------------------
// 5. Create JSON stubs for forms that do not have a data file yet
// ---------------------------------------------------------------------------

let created = 0;
let skipped = 0;

for (const id of primaryForms) {
  const dest = path.join(DATA_DIR, `${id}.json`);
  if (fs.existsSync(dest)) {
    skipped++;
    continue;
  }

  const stub = {
    returnHeader: {
      ReturnTs:           '2026-04-15T10:00:00',
      TaxYr:              '2025',
      TaxPeriodBeginDt:   '2025-01-01',
      TaxPeriodEndDt:     '2025-12-31',
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
