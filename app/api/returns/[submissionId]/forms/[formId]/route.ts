import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';

interface RouteContext {
  params: Promise<{ submissionId: string; formId: string }>;
}

export async function GET(req: NextRequest, { params }: RouteContext) {
  const { formId } = await params;

  // Sanitize: allow only alphanumeric and common IRS form ID characters
  if (!/^[A-Za-z0-9]+$/.test(formId)) {
    return NextResponse.json({ error: 'Invalid form ID' }, { status: 400 });
  }

  const year = req.nextUrl.searchParams.get('year') ?? '2025';
  if (!/^\d{4}$/.test(year)) {
    return NextResponse.json({ error: 'Invalid year' }, { status: 400 });
  }

  const base = path.join(process.cwd(), 'data', 'forms');

  // Try year-specific path first, then fall back to flat layout for compatibility
  const yearPath = path.join(base, year, `${formId}.json`);
  const flatPath = path.join(base, `${formId}.json`);

  try {
    const filePath = await fs.access(yearPath).then(() => yearPath).catch(() => flatPath);
    const raw = await fs.readFile(filePath, 'utf-8');
    const data = JSON.parse(raw);
    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { error: `Form data not found for: ${formId} (year: ${year})` },
      { status: 404 },
    );
  }
}
