/**
 * genericXmlSerializer.ts
 *
 * Converts ANY plain JavaScript data object into the AppData XML envelope
 * that IRS XSL stylesheets expect — with zero per-form boilerplate.
 *
 * Adding a new IRS form requires only:
 *   1. Drop the XSL + XSD files into /public/xsl/
 *   2. Add an entry to formRegistry.ts with id/label/xslUrl
 *   3. The API returns { returnHeader, formData } JSON — this file serializes it
 *
 * Serialization rules:
 *  • string | number | boolean   →  <Tag>value</Tag>
 *  • plain object                →  <Tag><children/></Tag>  (recursive)
 *  • array                       →  repeated <Tag>…</Tag> for every item
 *  • null | undefined | ""       →  omitted entirely
 *  • keys in IRS_ROOT_ATTRS      →  XML attributes on the root form element
 */

function esc(v: string): string {
  return v
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escAttr(v: string): string {
  return v
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;');
}

// From the DocumentAttributes attributeGroup in efileTypes.xsd.
// These become XML attributes on the root form element; every other key
// becomes a child element.
const IRS_ROOT_ATTRS = new Set([
  'documentId',
  'softwareId',
  'softwareVersionNum',
  'documentName',
  'referenceDocumentId',
  'referenceDocumentName',
]);

type Primitive = string | number | boolean;
type SerializableValue =
  | Primitive
  | Record<string, unknown>
  | SerializableValue[]
  | null
  | undefined;

function node(tag: string, value: SerializableValue): string {
  if (value === null || value === undefined || value === '') return '';

  if (Array.isArray(value)) {
    return value.map((item) => node(tag, item as SerializableValue)).join('');
  }

  if (typeof value === 'object') {
    const inner = Object.entries(value as Record<string, unknown>)
      .map(([k, v]) => node(k, v as SerializableValue))
      .join('');
    return inner ? `<${tag}>${inner}</${tag}>` : '';
  }

  return `<${tag}>${esc(String(value))}</${tag}>`;
}

export interface AppEnvelopeParams {
  DocumentId?: string;
  Stage?: string;
  AcceptanceStatus?: string;
  SubmissionType?: string;
  DisplayName?: string;
}

export interface AppProperties {
  SystemMode?: string;
}

/**
 * Build the complete AppData XML string for any IRS form.
 *
 * @param rootElement   The XSD root element name, e.g. "IRS1040", "IRSW2"
 * @param formData      Plain JS object whose keys map to XSD element/attribute names
 * @param appParams     AppData/Parameters block (DocumentId, Stage, …)
 * @param appProps      AppData/ApplicationProperties block (SystemMode)
 * @param returnHeader  Plain JS object matching the ReturnHeader XSD structure
 */
export function buildFormXml(
  rootElement: string,
  formData: Record<string, unknown>,
  appParams: AppEnvelopeParams,
  appProps: AppProperties,
  returnHeader: Record<string, unknown>,
): string {
  const attrParts: string[] = [];
  const childParts: string[] = [];

  for (const [key, value] of Object.entries(formData)) {
    if (value === null || value === undefined || value === '') continue;
    if (IRS_ROOT_ATTRS.has(key)) {
      attrParts.push(`${key}="${escAttr(String(value))}"`);
    } else {
      childParts.push(node(key, value as SerializableValue));
    }
  }

  const attrStr = attrParts.length ? ' ' + attrParts.join(' ') : '';
  const formXml = `<${rootElement}${attrStr}>${childParts.join('')}</${rootElement}>`;

  const returnHeaderXml =
    '<ReturnHeader>' +
    Object.entries(returnHeader)
      .map(([k, v]) => node(k, v as SerializableValue))
      .join('') +
    '</ReturnHeader>';

  const appPropsXml = appProps.SystemMode
    ? `<ApplicationProperties><SystemMode>${esc(appProps.SystemMode)}</SystemMode></ApplicationProperties>`
    : '';

  // SubmissionVersion is forced to "20250" so $TaxYear resolves to "2025",
  // matching the versioned asset paths under public/mef/.../2025/.
  const paramsXml =
    '<Parameters>' +
    (appParams.DocumentId ? `<DocumentId>${esc(appParams.DocumentId)}</DocumentId>` : '') +
    (appParams.Stage ? `<Stage>${esc(appParams.Stage)}</Stage>` : '') +
    '<SubmissionVersion>20250</SubmissionVersion>' +
    (appParams.AcceptanceStatus
      ? `<AcceptanceStatus>${esc(appParams.AcceptanceStatus)}</AcceptanceStatus>`
      : '') +
    (appParams.SubmissionType
      ? `<SubmissionType>${esc(appParams.SubmissionType)}</SubmissionType>`
      : '') +
    (appParams.DisplayName ? `<DisplayName>${esc(appParams.DisplayName)}</DisplayName>` : '') +
    '</Parameters>';

  return (
    '<?xml version="1.0" encoding="UTF-8"?>' +
    '<AppData>' +
    appPropsXml +
    paramsXml +
    '<SubmissionHeaderAndDocument>' +
    returnHeaderXml +
    '<SubmissionDocument>' +
    formXml +
    '</SubmissionDocument>' +
    '</SubmissionHeaderAndDocument>' +
    '</AppData>'
  );
}
