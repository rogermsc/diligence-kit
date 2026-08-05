import { NextRequest, NextResponse } from 'next/server'
import { makeAuthenticatedRequest, createUnauthorizedResponse } from '@/lib/auth-server'

// GET /api/automation/[automationId]/documents - Get documents by automation ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ automationId: string }> }
) {
  try {
    const { automationId } = await params

    if (!/^[a-zA-Z0-9_-]{1,200}$/.test(automationId)) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }

    const response = await makeAuthenticatedRequest(`/automation/${automationId}/documents`, {
      method: 'GET',
    })

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Request failed' },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    if (error instanceof Error && error.message === 'No authorization token available') {
      return createUnauthorizedResponse()
    }
    
    console.error('Error fetching documents:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 