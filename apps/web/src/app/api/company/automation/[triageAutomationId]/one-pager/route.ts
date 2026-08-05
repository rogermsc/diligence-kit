import { NextRequest, NextResponse } from 'next/server'
import { getAuthHeaders, createUnauthorizedResponse, getBaseUrl } from '@/lib/auth-server'

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ triageAutomationId: string }> }
) {
    try {
        const { triageAutomationId } = await params

        if (!/^[a-zA-Z0-9_-]{1,200}$/.test(triageAutomationId)) {
            return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
        }

        const authHeaders = await getAuthHeaders()

        if (!authHeaders) {
            return createUnauthorizedResponse()
        }

        const baseUrl = getBaseUrl()

        const response = await fetch(`${baseUrl}/company/automation/${triageAutomationId}/one-pager`, {
            method: 'GET',
            headers: {
                ...authHeaders,
            },
        })

        if (!response.ok) {
            console.error(`One-pager download failed: ${response.status}`)
            return NextResponse.json(
                { error: 'Download failed' },
                { status: response.status }
            )
        }

        // Get the blob data and forward it
        const blob = await response.blob()
        const buffer = await blob.arrayBuffer()

        // Try to get filename from content-disposition header or use default
        const contentDisposition = response.headers.get('Content-Disposition')
        let filename = `one_pager_${triageAutomationId}.pdf`

        if (contentDisposition) {
            const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/)
            if (filenameMatch && filenameMatch[1]) {
                filename = filenameMatch[1].replace(/['"]/g, '').replace(/[^a-zA-Z0-9._-]/g, '_')
            }
        }

        return new NextResponse(buffer, {
            status: 200,
            headers: {
                'Content-Type': response.headers.get('Content-Type') || 'application/pdf',
                'Content-Disposition': `attachment; filename="${filename}"`,
            },
        })
    } catch (error) {
        console.error('Error downloading one-pager:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}
