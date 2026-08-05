import { NextRequest, NextResponse } from 'next/server'
import { getAuthHeaders, createUnauthorizedResponse, getBaseUrl } from '@/lib/auth-server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ automationId: string }> }
) {
  try {
    const { automationId } = await params

    if (!/^[a-zA-Z0-9_-]{1,200}$/.test(automationId)) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }

    const authHeaders = await getAuthHeaders()

    if (!authHeaders) {
      return createUnauthorizedResponse()
    }

    const baseUrl = getBaseUrl()

    const response = await fetch(`${baseUrl}/automation/${automationId}/download-one-pager`, {
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
    let filename = `one_pager_${automationId}.pdf`

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
    console.error('Error downloading one-pager summary:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
