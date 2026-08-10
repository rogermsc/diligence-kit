import { NextResponse } from 'next/server'
import { getAuthHeaders } from '@/lib/auth-server'

/**
 * Whether the caller has a usable session.
 *
 * This used to answer "is there an access_token cookie", which is not the same
 * question — a cookie outliving its token reported the user as signed in while
 * every data call 401'd behind it. getAuthHeaders now checks the expiry and
 * renews or clears, so presence and validity have stopped being the same thing
 * and this route is honest without needing to know any of it.
 */
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