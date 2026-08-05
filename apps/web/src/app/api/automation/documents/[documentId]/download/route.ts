import { NextRequest, NextResponse } from 'next/server'
import { getAuthHeaders, createUnauthorizedResponse, getBaseUrl } from '@/lib/auth-server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ documentId: string }> }
) {
  try {
    const { documentId } = await params

    if (!/^[a-zA-Z0-9_-]{1,200}$/.test(documentId)) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }

    const authHeaders = await getAuthHeaders()

    if (!authHeaders) {
      return createUnauthorizedResponse()
    }

    const baseUrl = getBaseUrl()

    const response = await fetch(`${baseUrl}/automation/documents/${documentId}/download`, {
      method: 'GET',
      headers: { ...authHeaders },
    })

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Download failed' },
        { status: response.status }
      )
    }

    const blob = await response.blob()
    const buffer = await blob.arrayBuffer()

    const contentDisposition = response.headers.get('Content-Disposition')
    let filename = `document_${documentId}`

    if (contentDisposition) {
      const match = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/)
      if (match?.[1]) {
        filename = match[1].replace(/['"]/g, '').replace(/[^a-zA-Z0-9._-]/g, '_')
      }
    }

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': response.headers.get('Content-Type') || 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    console.error('Error downloading document:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 