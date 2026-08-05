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