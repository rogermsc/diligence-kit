import { NextRequest, NextResponse } from 'next/server'
import { makeAuthenticatedRequest, createUnauthorizedResponse } from '@/lib/auth-server'

const ID_RE = /^[a-zA-Z0-9_-]{1,200}$/

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ automationId: string }> }
) {
  try {
    const { automationId } = await params;

    if (!ID_RE.test(automationId)) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    const raw = await request.json();
    if (
      !raw || typeof raw !== 'object' ||
      typeof raw.companyId !== 'string' || !ID_RE.test(raw.companyId) ||
      typeof raw.automationId !== 'string' || !ID_RE.test(raw.automationId)
    ) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }
    const body = { companyId: raw.companyId, automationId: raw.automationId };

    const response = await makeAuthenticatedRequest(`/automation/${automationId}/second-stage`, {
      method: 'POST',
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    return NextResponse.json(data);

  } catch (error) {
    if (error instanceof Error && error.message === 'No authorization token available') {
      return createUnauthorizedResponse();
    }

    console.error('Error starting stage 2:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
