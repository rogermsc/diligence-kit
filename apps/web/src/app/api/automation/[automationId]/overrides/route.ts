import { NextRequest, NextResponse } from 'next/server'
import { getAuthHeaders, createUnauthorizedResponse, getBaseUrl } from '@/lib/auth-server'

/**
 * Human judgement recorded beside a run: read it, and add to it.
 *
 * The backend has had these routes, a table, an append-only revert and a
 * tenancy rule since the overrides migration. There was no proxy and no client,
 * so an analyst could not record a single correction.
 */

const VALID_ID = /^[a-zA-Z0-9_-]{1,200}$/

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ automationId: string }> }
) {
    try {
        const { automationId } = await params
        if (!VALID_ID.test(automationId)) {
            return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
        }

        const authHeaders = await getAuthHeaders()
        if (!authHeaders) return createUnauthorizedResponse()

        const response = await fetch(
            `${getBaseUrl()}/automation/${automationId}/overrides`,
            { method: 'GET', headers: { ...authHeaders } }
        )

        if (!response.ok) {
            console.error(`Overrides fetch failed: ${response.status}`)
            return NextResponse.json({ error: 'Request failed' }, { status: response.status })
        }

        return NextResponse.json(await response.json())
    } catch (error) {
        console.error('[API] Error fetching overrides:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ automationId: string }> }
) {
    try {
        const { automationId } = await params
        if (!VALID_ID.test(automationId)) {
            return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
        }

        const authHeaders = await getAuthHeaders()
        if (!authHeaders) return createUnauthorizedResponse()

        const response = await fetch(
            `${getBaseUrl()}/automation/${automationId}/override`,
            {
                method: 'POST',
                headers: { ...authHeaders, 'Content-Type': 'application/json' },
                body: JSON.stringify(await request.json()),
            }
        )

        if (!response.ok) {
            // The rationale is required at the schema level, so a 400 here is
            // usually a missing one. Forwarding the status lets the form say so.
            console.error(`Override create failed: ${response.status}`)
            return NextResponse.json({ error: 'Request failed' }, { status: response.status })
        }

        return NextResponse.json(await response.json())
    } catch (error) {
        console.error('[API] Error creating override:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
