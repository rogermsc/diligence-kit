import { NextRequest, NextResponse } from 'next/server'
import { makeAuthenticatedRequest, createUnauthorizedResponse } from '@/lib/auth-server'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ automationId: string }> }
) {
  try {
    const { automationId } = await params

    if (!/^[a-zA-Z0-9_-]{1,200}$/.test(automationId)) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }

    const response = await makeAuthenticatedRequest(`/automation/${automationId}/retry`, {
      method: 'POST',
      body: JSON.stringify({}),
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
