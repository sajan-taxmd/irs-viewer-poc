/**
 * formDataService.ts
 *
 * Thin fetch wrapper for the form-data API.
 * In development the Next.js Route Handler at
 *   /api/returns/[submissionId]/forms/[formId]
 * serves mock JSON from /data/forms/{year}/*.json.
 *
 * To point at a real backend, change the URL template below — nothing else changes.
 */

export interface FormApiResponse {
  returnHeader: Record<string, unknown>;
  formData: Record<string, unknown>;
}

export async function fetchFormData(
  submissionId: string,
  formId: string,
  taxYear: string = '2025',
): Promise<FormApiResponse> {
  const url =
    `/api/returns/${encodeURIComponent(submissionId)}/forms/${encodeURIComponent(formId)}` +
    `?year=${encodeURIComponent(taxYear)}`;
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`API ${res.status}${body ? ': ' + body : ''}`);
  }
  return res.json() as Promise<FormApiResponse>;
}
