import { NextRequest, NextResponse } from 'next/server';
import { getAuthHeaders, createUnauthorizedResponse, getBaseUrl } from '@/lib/auth-server';

export async function GET(request: NextRequest) {
  try {
    const authHeaders = await getAuthHeaders();
    if (!authHeaders) {
      return createUnauthorizedResponse();
    }

    const sessionId = request.nextUrl.searchParams.get('session_id');
    if (!sessionId || !/^[0-9a-f-]{36}$/i.test(sessionId)) {
      return NextResponse.json(
        { error: 'Invalid or missing session_id' },
        { status: 400 }
      );
    }

    const baseUrl = getBaseUrl();

    const response = await fetch(`${baseUrl}/liaison/messages/${sessionId}`, {
      method: 'GET',
      headers: authHeaders,
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Request failed' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error getting messages:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
