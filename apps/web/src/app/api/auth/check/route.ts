import { NextResponse } from 'next/server'
import { getAuthHeaders } from '@/lib/auth-server'

export async function GET() {
  try {
    const authHeaders = await getAuthHeaders()
    
    if (!authHeaders) {
      return NextResponse.json({ authenticated: false }, { status: 200 })
    }

    return NextResponse.json({ authenticated: true }, { status: 200 })
  } catch (error) {
    console.error('Error checking authentication:', error)
    return NextResponse.json({ authenticated: false }, { status: 200 })
  }
} 