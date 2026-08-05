import { NextRequest, NextResponse } from 'next/server'
import { getBaseUrl } from '@/lib/auth-server'

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
    return NextResponse.json(data)
  } catch (error) {
    console.error('Error during login:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 