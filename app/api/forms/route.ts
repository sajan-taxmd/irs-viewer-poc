import { NextResponse } from 'next/server';
import { FORM_REGISTRY } from '@/lib/formRegistry';

export async function GET() {
  const forms = FORM_REGISTRY.map(({ id, label }) => ({ id, label }));
  return NextResponse.json(forms);
}
