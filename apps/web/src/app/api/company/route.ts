import { NextRequest, NextResponse } from 'next/server'
import { makeAuthenticatedRequest, createUnauthorizedResponse } from '@/lib/auth-server'

// GET /api/company - Get all companies
export async function GET() {
  try {
    const response = await makeAuthenticatedRequest('/company', {
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
    
    console.error('Error fetching companies:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST /api/company - Create a new company
export async function POST(request: NextRequest) {
  try {
    const raw = await request.json()
    if (!raw || typeof raw.name !== 'string' || raw.name.trim().length === 0) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }
    const body = { name: raw.name.trim() }

    const response = await makeAuthenticatedRequest('/company', {
      method: 'POST',
      body: JSON.stringify(body),
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
    
    console.error('Error creating company:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 