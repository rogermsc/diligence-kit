import { NextRequest, NextResponse } from 'next/server'
import { makeAuthenticatedRequest, createUnauthorizedResponse } from '@/lib/auth-server'

// GET /api/company/[id] - Get company by ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    if (!/^[a-zA-Z0-9_-]{1,200}$/.test(id)) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }

    const response = await makeAuthenticatedRequest(`/company/${id}`, {
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
    
    console.error('Error fetching company:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE /api/company/[id] - Delete company by ID
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    if (!/^[a-zA-Z0-9_-]{1,200}$/.test(id)) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }

    const response = await makeAuthenticatedRequest(`/company/${id}`, {
      method: 'DELETE',
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
    
    console.error('Error deleting company:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 