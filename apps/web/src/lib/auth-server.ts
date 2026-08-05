import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export function getBaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_API_BASE_URL || process.env.API_BASE_URL
  if (!url) throw new Error('API_BASE_URL is not configured')
  return url
}

export async function getAuthHeaders(): Promise<{ Authorization: string } | null> {
  try {
    const cookieStore = await cookies()
    const accessToken = cookieStore.get('access_token')?.value

    if (!accessToken) {
      return null
    }

    return {
      Authorization: `Bearer ${accessToken}`
    }
  } catch (error) {
    console.error('Error getting auth headers:', error)
    return null
  }
}

const SESSION_COOKIE = {
  httpOnly: true,
  secure: true,
  sameSite: 'strict',
  path: '/',
} as const

/**
 * Write the session cookies. Server-side only, and deliberately not reachable from
 * a route handler that accepts caller-supplied tokens: tokens must come straight
 * from the backend's login/refresh response and never round-trip through the
 * browser, or the httpOnly flag buys nothing.
 */
export async function setSessionCookies(accessToken: string, refreshToken: string) {
  const cookieStore = await cookies()
  cookieStore.set('access_token', accessToken, { ...SESSION_COOKIE, maxAge: 60 * 60 * 24 })
  cookieStore.set('refresh_token', refreshToken, { ...SESSION_COOKIE, maxAge: 60 * 60 * 24 * 7 })
}

export async function clearSessionCookies() {
  const cookieStore = await cookies()
  cookieStore.set('access_token', '', { ...SESSION_COOKIE, maxAge: 0 })
  cookieStore.set('refresh_token', '', { ...SESSION_COOKIE, maxAge: 0 })
}

/**
 * Create an unauthorized response
 */
export function createUnauthorizedResponse() {
  return NextResponse.json(
    { error: 'Unauthorized' },
    { status: 401 }
  )
}

/**
 * Make an authenticated request to the external API
 * Server-side only function
 */
export async function makeAuthenticatedRequest(
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> {
  const authHeaders = await getAuthHeaders()
  
  if (!authHeaders) {
    throw new Error('No authorization token available')
  }

  const baseUrl = getBaseUrl()

  return fetch(`${baseUrl}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders,
      ...options.headers,
    },
  })
} 