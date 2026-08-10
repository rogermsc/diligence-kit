import { NextRequest, NextResponse } from 'next/server'
import { getAuthHeaders, createUnauthorizedResponse, getBaseUrl } from '@/lib/auth-server'

/**
 * The structured analysis behind the one-pager.
 *
 * Sibling of the `/one-pager` route, which streams the rendered PDF. This
 * returns what it was rendered from, so the UI can show the reasoning instead
 * of a download link.
 */
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

        const response = await fetch(
            `${getBaseUrl()}/company/automation/${triageAutomationId}/analysis`,
            { method: 'GET', headers: { ...authHeaders } }
        )

        if (!response.ok) {
            // Deliberately not forwarding the upstream body: it can name records
            // the caller does not own, and the status is all the client acts on.
            console.error(`Analysis fetch failed: ${response.status}`)
            return NextResponse.json(
                { error: 'Request failed' },
                { status: response.status }
            )
        }

        return NextResponse.json(await response.json())
    } catch (error) {
        console.error('[API] Error fetching analysis:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}
