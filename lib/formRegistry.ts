/**
 * formRegistry.ts
 *
 * Central registry of every IRS form the viewer supports.
 * This file holds ONLY static metadata — no tax data.
 *
 * Form data (returnHeader + formData) comes from the API at runtime:
 *   GET /api/returns/:submissionId/forms/:formId
 *
 * To add a new form:
 *   1. Drop its *.xsl, *Style.xsl, *.xsd into /public/xsl/
 *   2. Add a mock JSON payload to /data/forms/<FormId>.json
 *   3. Add one FormEntry below — done.
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
  /** AppData/Parameters block */
  appParams: AppEnvelopeParams;
  /** AppData/ApplicationProperties block */
  appProps: AppProperties;
}

export const FORM_REGISTRY: FormEntry[] = [
  {
    id: 'IRS1040',
    label: 'Form 1040 — U.S. Individual Income Tax Return',
    xslUrl: '/xsl/IRS1040.xsl',
    xsdUrl: '/xsl/IRS1040.xsd',
    appParams: {
      DocumentId: 'IRS1040-DOC-001',
      Stage: 'original',
      AcceptanceStatus: 'A',
      SubmissionType: 'Individual',
      DisplayName: 'Form 1040',
    },
    appProps: { SystemMode: 'Test' },
  },
  {
    id: 'IRSW2',
    label: 'Form W-2 — Wage and Tax Statement',
    xslUrl: '/xsl/IRSW2.xsl',
    xsdUrl: '/xsl/IRSW2.xsd',
    appParams: {
      DocumentId: 'W2-DOC-001',
      Stage: 'original',
      AcceptanceStatus: 'A',
      SubmissionType: 'Individual',
      DisplayName: 'Form W-2',
    },
    appProps: { SystemMode: 'Test' },
  },
  {
    id: 'IRS1040ScheduleC',
    label: 'Schedule C — Profit or Loss from Business',
    xslUrl: '/xsl/IRS1040ScheduleC.xsl',
    xsdUrl: '/xsl/IRS1040ScheduleC.xsd',
    appParams: {
      DocumentId: 'SCHC-DOC-001',
      Stage: 'original',
      AcceptanceStatus: 'A',
      SubmissionType: 'Individual',
      DisplayName: 'Schedule C',
    },
    appProps: { SystemMode: 'Test' },
  },
  {
    id: 'IRS1040ScheduleD',
    label: 'Schedule D — Capital Gains and Losses',
    xslUrl: '/xsl/IRS1040ScheduleD.xsl',
    xsdUrl: '/xsl/IRS1040ScheduleD.xsd',
    appParams: {
      DocumentId: 'SCHD-DOC-001',
      Stage: 'original',
      AcceptanceStatus: 'A',
      SubmissionType: 'Individual',
      DisplayName: 'Schedule D',
    },
    appProps: { SystemMode: 'Test' },
  },
  {
    id: 'IRS1040ScheduleE',
    label: 'Schedule E — Supplemental Income and Loss',
    xslUrl: '/xsl/IRS1040ScheduleE.xsl',
    xsdUrl: '/xsl/IRS1040ScheduleE.xsd',
    appParams: {
      DocumentId: 'SCHE-DOC-001',
      Stage: 'original',
      AcceptanceStatus: 'A',
      SubmissionType: 'Individual',
      DisplayName: 'Schedule E',
    },
    appProps: { SystemMode: 'Test' },
  },
  {
    id: 'IRS1120SScheduleK1',
    label: 'Form 1120-S Schedule K-1 — Shareholder\'s Share of Income',
    xslUrl: '/xsl/IRS1120SScheduleK1.xsl',
    xsdUrl: '/xsl/IRS1120SScheduleK1.xsd',
    appParams: {
      DocumentId: 'K1S-DOC-001',
      Stage: 'original',
      AcceptanceStatus: 'A',
      SubmissionType: 'SCorporation',
      DisplayName: 'Schedule K-1 (1120-S)',
    },
    appProps: { SystemMode: 'Test' },
  },
  {
    id: 'IRS1065',
    label: 'Form 1065 — U.S. Return of Partnership Income',
    xslUrl: '/xsl/IRS1065.xsl',
    appParams: {
      DocumentId: 'IRS1065-DOC-001',
      Stage: 'original',
      AcceptanceStatus: 'A',
      SubmissionType: 'Partnership',
      DisplayName: 'Form 1065',
    },
    appProps: { SystemMode: 'Test' },
  },
  {
    id: 'IRS1065ScheduleK1',
    label: 'Form 1065 Schedule K-1 — Partner\'s Share of Income',
    xslUrl: '/xsl/IRS1065ScheduleK1.xsl',
    xsdUrl: '/xsl/IRS1065ScheduleK1.xsd',
    appParams: {
      DocumentId: 'K1P-DOC-001',
      Stage: 'original',
      AcceptanceStatus: 'A',
      SubmissionType: 'Partnership',
      DisplayName: 'Schedule K-1 (1065)',
    },
    appProps: { SystemMode: 'Test' },
  },
];
