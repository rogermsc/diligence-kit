import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { access_token, refresh_token } = body

    if (!access_token || !refresh_token) {
      return NextResponse.json(
        { error: 'Missing access_token or refresh_token' },
        { status: 400 }
      )
    }

    const cookieStore = await cookies()
    
    // Set access token cookie (expires in 24 hours)
    cookieStore.set('access_token', access_token, {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      maxAge: 60 * 60 * 24,
      path: '/',
    })

    cookieStore.set('refresh_token', refresh_token, {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    })

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error) {
    console.error('Error setting cookies:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 