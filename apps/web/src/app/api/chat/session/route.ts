import { NextRequest, NextResponse } from 'next/server';
import { getAuthHeaders, createUnauthorizedResponse, getBaseUrl } from '@/lib/auth-server';

export async function GET(request: NextRequest) {
  try {
    const authHeaders = await getAuthHeaders();
    if (!authHeaders) {
      return createUnauthorizedResponse();
    }

    const baseUrl = getBaseUrl();

    const response = await fetch(`${baseUrl}/liaison/session/last`, {
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
    console.error('Error getting session:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const authHeaders = await getAuthHeaders();
    if (!authHeaders) {
      return createUnauthorizedResponse();
    }

    const baseUrl = getBaseUrl();

    const response = await fetch(`${baseUrl}/liaison/session/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
      },
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
    console.error('Error creating session:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
