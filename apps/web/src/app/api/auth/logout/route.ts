import { NextResponse } from 'next/server'
import { clearSessionCookies } from '@/lib/auth-server'

export async function POST() {
  try {
    await clearSessionCookies()
    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error) {
    console.error('Error clearing cookies:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
