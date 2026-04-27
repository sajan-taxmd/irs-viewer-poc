import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';

interface RouteContext {
  params: Promise<{ submissionId: string; formId: string }>;
}

export async function GET(_req: Request, { params }: RouteContext) {
  const { formId } = await params;

  // Sanitize: allow only alphanumeric and common IRS form ID characters
  if (!/^[A-Za-z0-9]+$/.test(formId)) {
    return NextResponse.json({ error: 'Invalid form ID' }, { status: 400 });
  }

  try {
    const filePath = path.join(process.cwd(), 'data', 'forms', `${formId}.json`);
    const raw = await fs.readFile(filePath, 'utf-8');
    const data = JSON.parse(raw);
    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { error: `Form data not found for: ${formId}` },
      { status: 404 },
    );
  }
}
