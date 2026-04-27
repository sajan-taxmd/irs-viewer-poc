'use client';

import dynamic from 'next/dynamic';

const FormViewer = dynamic(() => import('./FormViewer'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-screen bg-slate-100 text-slate-500 text-sm">
      Initializing IRS Form Viewer…
    </div>
  ),
});

export default function FormViewerShell() {
  return <FormViewer />;
}
