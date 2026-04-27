/**
 * xslTransform.js — Browser-only ES module (no SSR).
 *
 * Import this only inside "use client" components or via
 * dynamic(() => import(...), { ssr: false }).
 */

const XSL_NS = 'http://www.w3.org/1999/XSL/Transform';

/**
 * Recursively fetch and inline all xsl:include AND xsl:import directives.
 *
 * The browser's XSLTProcessor cannot follow relative hrefs itself when the
 * stylesheet was loaded as text and re-parsed (no base URL on the document).
 *
 * xsl:import is handled identically to xsl:include for inlining purposes.
 * Both directives are processed in document order so that the import/include
 * sequence is preserved before the XSLTProcessor sees the merged stylesheet.
 */
async function resolveIncludes(xslDoc, baseUrl) {
  // Collect both <xsl:include> and <xsl:import> in document order.
  const directives = Array.from(
    xslDoc.documentElement.childNodes,
  ).filter(
    (n) =>
      n.nodeType === Node.ELEMENT_NODE &&
      n.namespaceURI === XSL_NS &&
      (n.localName === 'include' || n.localName === 'import'),
  );

  for (const directive of directives) {
    const href = directive.getAttribute('href');
    if (!href) continue;

    const resolvedUrl = new URL(href, baseUrl).toString();
    const kind = directive.localName; // "include" or "import"

    let text;
    try {
      const res = await fetch(resolvedUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      text = await res.text();
    } catch (err) {
      throw new Error(`Failed to load xsl:${kind} "${href}": ${err.message}`);
    }

    const parser = new DOMParser();
    const included = parser.parseFromString(text, 'application/xml');
    const parseErr = included.querySelector('parsererror');
    if (parseErr) throw new Error(`Parse error in "${href}": ${parseErr.textContent}`);

    // Recurse so nested includes/imports inside this file are also resolved.
    await resolveIncludes(included, resolvedUrl);

    const parent = directive.parentNode;
    for (const child of Array.from(included.documentElement.childNodes)) {
      if (child.nodeType === Node.ELEMENT_NODE) {
        parent.insertBefore(xslDoc.importNode(child, true), directive);
      }
    }
    parent.removeChild(directive);
  }
}

/**
 * Wrap a bare form XML document (or null) in the AppData envelope.
 * If xmlDoc already has <AppData> as root it is returned unchanged.
 */
function buildAppData(xmlDoc, fallbackFormElement = 'IRS1040') {
  const TAX_YEAR = '2025';
  const SUBMISSION_VERSION = `${TAX_YEAR}0`;

  if (xmlDoc && xmlDoc.documentElement?.localName === 'AppData') return xmlDoc;

  const doc = document.implementation.createDocument(null, 'AppData', null);
  const appData = doc.documentElement;

  const params = doc.createElement('Parameters');
  const ver = doc.createElement('SubmissionVersion');
  ver.textContent = SUBMISSION_VERSION;
  params.appendChild(ver);
  appData.appendChild(params);

  const subBlock = doc.createElement('SubmissionHeaderAndDocument');
  subBlock.appendChild(doc.createElement('ReturnHeader'));

  const subDoc = doc.createElement('SubmissionDocument');
  if (xmlDoc && xmlDoc.documentElement) {
    subDoc.appendChild(doc.importNode(xmlDoc.documentElement, true));
  } else {
    subDoc.appendChild(doc.createElement(fallbackFormElement));
  }
  subBlock.appendChild(subDoc);
  appData.appendChild(subBlock);

  return doc;
}

/**
 * Transform any IRS XML string using the given XSL stylesheet.
 *
 * @param {string|null} xmlString  - AppData XML string, or null for blank form
 * @param {string}      xslUrl     - root-relative URL, e.g. "/xsl/IRS1040.xsl"
 * @returns {Promise<string>}      - resulting HTML string
 */
export async function transformForm(xmlString, xslUrl) {
  const parser = new DOMParser();

  const absoluteXslUrl = new URL(xslUrl, window.location.href).toString();
  const xslText = await fetch(absoluteXslUrl).then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status} loading ${xslUrl}`);
    return r.text();
  });

  const xslDoc = parser.parseFromString(xslText, 'application/xml');
  const xslErr = xslDoc.querySelector('parsererror');
  if (xslErr) throw new Error(`XSL parse error: ${xslErr.textContent}`);

  await resolveIncludes(xslDoc, absoluteXslUrl);

  let rawXmlDoc = null;
  if (xmlString && xmlString.trim()) {
    rawXmlDoc = parser.parseFromString(xmlString.trim(), 'application/xml');
    const xmlErr = rawXmlDoc.querySelector('parsererror');
    if (xmlErr) throw new Error(`XML parse error: ${xmlErr.textContent}`);
  }

  const xmlDoc = buildAppData(rawXmlDoc);

  const proc = new XSLTProcessor();
  proc.importStylesheet(xslDoc);

  const resultDoc = proc.transformToDocument(xmlDoc);
  if (!resultDoc || !resultDoc.documentElement) {
    throw new Error(
      'XSLTProcessor returned null — verify the XML matches the expected schema.',
    );
  }

  return '<!DOCTYPE html>\n' + resultDoc.documentElement.outerHTML;
}
