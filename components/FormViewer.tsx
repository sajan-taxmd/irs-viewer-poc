'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { FORM_REGISTRY } from '@/lib/formRegistry';
import type { FormEntry } from '@/lib/formRegistry';
import { buildFormXml } from '@/lib/genericXmlSerializer';
import { fetchFormData } from '@/lib/api/formDataService';
import { transformForm } from '@/lib/xslTransform.js';

type Status = 'idle' | 'loading' | 'ready' | 'error';

export default function FormViewer() {
  const [selectedId, setSelectedId] = useState<string>(FORM_REGISTRY[0].id);
  const [submissionId, setSubmissionId] = useState<string>('DEMO-001');
  const [status, setStatus] = useState<Status>('idle');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const selectedEntry: FormEntry =
    FORM_REGISTRY.find((f) => f.id === selectedId) ?? FORM_REGISTRY[0];

  const loadForm = useCallback(async () => {
    if (!submissionId.trim()) {
      setErrorMsg('Please enter a Submission ID.');
      setStatus('error');
      return;
    }
    setStatus('loading');
    setErrorMsg('');

    try {
      const { returnHeader, formData } = await fetchFormData(
        submissionId.trim(),
        selectedEntry.id,
      );

      const xml = buildFormXml(
        selectedEntry.xmlRootElement ?? selectedEntry.id,
        formData,
        selectedEntry.appParams,
        selectedEntry.appProps,
        returnHeader,
      );

      const html = await transformForm(xml, selectedEntry.xslUrl);

      const iframe = iframeRef.current;
      if (iframe) {
        const doc = iframe.contentDocument ?? iframe.contentWindow?.document;
        if (doc) {
          doc.open();
          doc.write(html);
          doc.close();
        }
      }
      setStatus('ready');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMsg(msg);
      setStatus('error');
    }
  }, [selectedEntry, submissionId]);

  // Reset status when the form selection changes
  useEffect(() => {
    setStatus('idle');
    setErrorMsg('');
  }, [selectedId]);

  const statusPill = {
    idle: { bg: 'bg-white/15', text: 'text-blue-200', label: 'Select a form and click Load' },
    loading: { bg: 'bg-white/15', text: 'text-blue-200', label: '⏳ Loading…' },
    ready: { bg: 'bg-green-400/80', text: 'text-green-950', label: '✓ Ready' },
    error: { bg: 'bg-red-400/80', text: 'text-red-950', label: '✕ Error' },
  }[status];

  return (
    <div className="flex flex-col h-screen bg-slate-100 overflow-hidden">
      {/* ── Toolbar ─────────────────────────────────────────── */}
      <header className="shrink-0 flex items-center gap-3 px-4 h-14 bg-linear-to-r from-slate-900 to-blue-900 shadow-lg">
        {/* Badge */}
        <span className="shrink-0 bg-red-500 text-white text-[11px] font-bold px-2.5 py-1 rounded">
          IRS
        </span>

        {/* Form selector */}
        <select
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          className="min-w-0 max-w-xs flex-1 bg-white/10 border border-white/25 text-white text-sm font-medium rounded px-2.5 py-1.5 appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-400"
        >
          {FORM_REGISTRY.map((f) => (
            <option key={f.id} value={f.id} className="bg-slate-800 text-white">
              {f.label}
            </option>
          ))}
        </select>

        {/* Submission ID input */}
        <input
          type="text"
          value={submissionId}
          onChange={(e) => setSubmissionId(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && loadForm()}
          placeholder="Submission ID"
          className="w-40 bg-white/10 border border-white/25 text-white text-sm placeholder:text-white/50 rounded px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-400"
        />

        {/* Load button */}
        <button
          onClick={loadForm}
          disabled={status === 'loading'}
          className="shrink-0 bg-blue-500 hover:bg-blue-400 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold px-4 py-1.5 rounded transition-colors"
        >
          {status === 'loading' ? 'Loading…' : 'Load Form'}
        </button>

        {/* Status pill */}
        <span
          className={`shrink-0 text-[11px] font-semibold px-3 py-1 rounded-full ${statusPill.bg} ${statusPill.text}`}
        >
          {statusPill.label}
        </span>
      </header>

      {/* ── Error banner ────────────────────────────────────── */}
      {status === 'error' && errorMsg && (
        <div className="shrink-0 flex items-start gap-3 bg-red-50 border-b border-red-200 px-4 py-3 text-sm text-red-800">
          <span className="font-bold mt-0.5">Error:</span>
          <pre className="whitespace-pre-wrap break-all font-mono text-xs leading-5">
            {errorMsg}
          </pre>
        </div>
      )}

      {/* ── Idle placeholder ────────────────────────────────── */}
      {status === 'idle' && (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 text-slate-400">
          <div className="text-6xl select-none">📋</div>
          <p className="text-lg font-medium">No form loaded</p>
          <p className="text-sm">
            Select a form, enter a Submission ID and click{' '}
            <strong className="text-slate-600">Load Form</strong>
          </p>
        </div>
      )}

      {/* ── Form iframe ─────────────────────────────────────── */}
      <iframe
        ref={iframeRef}
        title="IRS Form Viewer"
        className={`flex-1 w-full border-0 bg-white ${status === 'idle' ? 'hidden' : 'block'}`}
        sandbox="allow-same-origin allow-scripts"
      />
    </div>
  );
}
