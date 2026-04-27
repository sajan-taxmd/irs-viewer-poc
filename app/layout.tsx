import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'IRS Form Viewer',
  description: 'Browser-based IRS e-file form renderer using official MEF XSL stylesheets',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
