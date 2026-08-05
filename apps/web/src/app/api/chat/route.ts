import { NextRequest, NextResponse } from 'next/server';
import { getAuthHeaders, createUnauthorizedResponse, getBaseUrl } from '@/lib/auth-server';

export async function POST(request: NextRequest) {
  try {
    const authHeaders = await getAuthHeaders();
    if (!authHeaders) {
      return createUnauthorizedResponse();
    }

    const body = await request.json();
    const baseUrl = getBaseUrl();

    const response = await fetch(`${baseUrl}/liaison/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
      },
      body: JSON.stringify(body),
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
    console.error('Error sending chat message:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
