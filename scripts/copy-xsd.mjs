/**
 * copy-xsd.mjs
 *
 * Copies IRS MEF XSD schema files from the local schema package into
 * public/xsl/{year}/ so they are served as static files by Next.js.
 *
 * Usage:
 *   node scripts/copy-xsd.mjs
 *
 * Source:
 *   /home/sajan/irs/1040x_2025v5.2 (2)/1040x_Schema_2025v5.2/2025v5.2/
 *   (nested as {category}/{IRS{FormId}/IRS{FormId}.xsd})
 *
 * Destination:
 *   public/xsl/2025/IRS{FormId}.xsd  (flattened)
 *
 * After running this script, re-run generate-forms.mjs to update
 * formRegistry.ts with xsdUrl for all matched forms.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const SOURCES = [
  {
    year: '2025',
    dir: '/home/sajan/irs/1040x_2025v5.2 (2)/1040x_Schema_2025v5.2/2025v5.2',
  },
];

/**
 * Recursively collect all files matching IRS*.xsd under a directory.
 */
function findXsdFiles(dir) {
  const results = [];
  if (!fs.existsSync(dir)) return results;

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findXsdFiles(full));
    } else if (entry.isFile() && entry.name.startsWith('IRS') && entry.name.endsWith('.xsd')) {
      results.push(full);
    }
  }
  return results;
}

let totalCopied = 0;
let totalSkipped = 0;
let totalErrors = 0;

for (const { year, dir } of SOURCES) {
  const dest = path.join(ROOT, 'public', 'xsl', year);
  fs.mkdirSync(dest, { recursive: true });

  console.log(`\nScanning: ${dir}`);
  const files = findXsdFiles(dir);
  console.log(`  Found ${files.length} IRS*.xsd file(s)`);

  let copied = 0;
  let skipped = 0;
  let errors = 0;

  for (const src of files) {
    const filename = path.basename(src);
    const target = path.join(dest, filename);

    if (fs.existsSync(target)) {
      skipped++;
      continue;
    }

    try {
      fs.copyFileSync(src, target);
      copied++;
    } catch (err) {
      console.error(`  ERROR copying ${filename}: ${err.message}`);
      errors++;
    }
  }

  console.log(`  Copied:  ${copied}`);
  console.log(`  Skipped: ${skipped} (already present)`);
  if (errors > 0) console.warn(`  Errors:  ${errors}`);

  totalCopied += copied;
  totalSkipped += skipped;
  totalErrors += errors;
}

console.log(`\nDone. Total copied: ${totalCopied}, skipped: ${totalSkipped}, errors: ${totalErrors}`);
if (totalCopied > 0) {
  console.log('\nNext step: node scripts/generate-forms.mjs');
}
