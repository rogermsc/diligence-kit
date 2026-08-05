import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function POST() {
  try {
    const cookieStore = await cookies()
    
    cookieStore.set('access_token', '', {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      maxAge: 0,
      path: '/',
    })

    cookieStore.set('refresh_token', '', {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      maxAge: 0,
      path: '/',
    })

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error) {
    console.error('Error clearing cookies:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 