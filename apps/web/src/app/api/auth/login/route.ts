import { NextRequest, NextResponse } from 'next/server'
import { getBaseUrl, setSessionCookies } from '@/lib/auth-server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    if (
      typeof body?.email !== 'string' || body.email.length === 0 ||
      typeof body?.password !== 'string' || body.password.length === 0
    ) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }
    const baseUrl = getBaseUrl()
    
    const response = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Request failed' },
        { status: response.status }
      )
    }

    const data = await response.json()

    if (!data?.access_token || !data?.refresh_token) {
      console.error('Login response missing tokens')
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

    // Set here and never returned to the browser: the client only learns that
    // login succeeded, so client-side JS never holds a credential.
    await setSessionCookies(data.access_token, data.refresh_token)

    return NextResponse.json({ success: true, user: data.user ?? null })
  } catch (error) {
    console.error('Error during login:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 