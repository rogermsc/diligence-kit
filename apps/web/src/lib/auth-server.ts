import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export function getBaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_API_BASE_URL || process.env.API_BASE_URL
  if (!url) throw new Error('API_BASE_URL is not configured')
  return url
}

/** Refresh this many seconds before the access token actually expires. */
const REFRESH_MARGIN_SECONDS = 60

/**
 * Reads `exp` out of a JWT without verifying it.
 *
 * This is not authentication and must never be treated as such — the backend
 * verifies the signature on every call. All we need here is the expiry, to
 * decide whether to spend a refresh before making a request we know would 401.
 *
 * Exported for its test; nothing else should call it.
 */
export function expiresAt(token: string): number | null {
  try {
    const payload = token.split('.')[1]
    if (!payload) return null
    const decoded = JSON.parse(
      Buffer.from(payload.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'),
    ) as { exp?: number }
    return typeof decoded.exp === 'number' ? decoded.exp : null
  } catch {
    return null
  }
}

/**
 * One refresh in flight at a time.
 *
 * The dashboard fires several API calls in parallel, and refresh tokens rotate
 * — the backend revokes the old one. Without this, two concurrent requests both
 * refresh, the second presents a token the first just invalidated, and the user
 * is signed out for loading a page too fast.
 *
 * ponytail: per process. A second replica can still race a first; the loser
 * falls through to a 401 and a re-login rather than anything worse. Move this to
 * Redis if the deployment ever runs more than one web instance.
 */
let inFlightRefresh: Promise<string | null> | null = null

async function refreshAccessToken(refreshToken: string): Promise<string | null> {
  if (inFlightRefresh) return inFlightRefresh

  inFlightRefresh = (async () => {
    try {
      const response = await fetch(`${getBaseUrl()}/auth/refresh-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // camelCase in, snake_case out. The asymmetry is the backend's; naming
        // it here so nobody "fixes" one side in isolation.
        body: JSON.stringify({ refreshToken }),
      })

      if (!response.ok) {
        console.error(`Token refresh rejected: ${response.status}`)
        return null
      }

      const tokens = (await response.json()) as {
        access_token: string
        refresh_token: string
      }
      await setSessionCookies(tokens.access_token, tokens.refresh_token)
      return tokens.access_token
    } catch (error) {
      console.error('Token refresh failed:', error)
      return null
    } finally {
      inFlightRefresh = null
    }
  })()

  return inFlightRefresh
}

/**
 * The single choke point every API route reaches, directly or through
 * makeAuthenticatedRequest — so the session is renewed here rather than in
 * eighteen route handlers.
 *
 * Renewal is proactive, not a retry after a 401. A retry would have to replay
 * the original request, and a request body can only be read once, so every
 * multipart upload route would have needed a special case. Checking the expiry
 * first avoids the replay entirely.
 *
 * A token revoked server-side inside its remaining lifetime still reads as
 * valid here; the backend rejects it on the next call. That window is minutes,
 * against the day-long one this replaces.
 */
export async function getAuthHeaders(): Promise<{ Authorization: string } | null> {
  try {
    const cookieStore = await cookies()
    const accessToken = cookieStore.get('access_token')?.value
    const refreshToken = cookieStore.get('refresh_token')?.value

    if (!accessToken) {
      return null
    }

    const expiry = expiresAt(accessToken)
    const stale =
      expiry !== null && expiry - REFRESH_MARGIN_SECONDS <= Math.floor(Date.now() / 1000)

    if (stale) {
      // The refresh cookie was written at login and, until now, read by
      // nothing at all — so a session died on the hour its access token
      // expired, while the cookie sat there for another six days.
      if (!refreshToken) {
        await clearSessionCookies()
        return null
      }

      const renewed = await refreshAccessToken(refreshToken)
      if (!renewed) {
        // Clear both, so the next request is an honest signed-out rather than a
        // stale cookie that renders as logged in while every call 401s.
        await clearSessionCookies()
        return null
      }
      return { Authorization: `Bearer ${renewed}` }
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