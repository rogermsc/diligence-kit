import { NextRequest, NextResponse } from 'next/server'
import { makeAuthenticatedRequest, createUnauthorizedResponse } from '@/lib/auth-server'

interface ConfirmFile { fileName: string; gcsPath: string }

function isValidConfirmBody(body: unknown): body is { companyId: string; files: ConfirmFile[] } {
  if (!body || typeof body !== 'object') return false
  const b = body as Record<string, unknown>
  if (typeof b.companyId !== 'string' || b.companyId.length === 0) return false
  if (!Array.isArray(b.files)) return false
  return b.files.every(
    (f: unknown) =>
      f !== null &&
      typeof f === 'object' &&
      typeof (f as Record<string, unknown>).fileName === 'string' &&
      typeof (f as Record<string, unknown>).gcsPath === 'string'
  )
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ automationId: string }> }
) {
  try {
    const { automationId } = await params

    if (!/^[a-zA-Z0-9_-]{1,200}$/.test(automationId)) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }

    const raw = await request.json()
    if (!isValidConfirmBody(raw)) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }
    const body = raw

    const response = await makeAuthenticatedRequest(`/automation/${automationId}/confirm`, {
      method: 'POST',
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      return NextResponse.json({ error: 'Request failed' }, { status: response.status })
    }

    return NextResponse.json(await response.json())
  } catch (error) {
    if (error instanceof Error && error.message === 'No authorization token available') {
      return createUnauthorizedResponse()
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
