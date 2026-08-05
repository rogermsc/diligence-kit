import { NextRequest, NextResponse } from 'next/server'
import { getAuthHeaders, createUnauthorizedResponse, getBaseUrl } from '@/lib/auth-server'

const ALLOWED_EXTENSIONS = new Set([
  'pdf', 'csv', 'xls', 'xlsx', 'doc', 'docx', 'txt',
  'ppt', 'pptx',
  'png', 'jpg', 'jpeg', 'tiff', 'tif', 'bmp', 'webp',
])

const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50 MB per document

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ automationId: string }> }
) {
  try {
    const { automationId } = await params

    if (!/^[a-zA-Z0-9_-]{1,200}$/.test(automationId)) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }

    const authHeaders = await getAuthHeaders()
    if (!authHeaders) return createUnauthorizedResponse()

    const formData = await request.formData()
    const baseUrl = getBaseUrl()

    const file = formData.get('file')
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'File too large' }, { status: 413 })
    }

    const filename = file.name
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return NextResponse.json({ error: 'Invalid filename' }, { status: 400 })
    }

    const ext = filename.split('.').pop()?.toLowerCase() ?? ''
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      return NextResponse.json({ error: 'File type not allowed' }, { status: 415 })
    }

    // Intentionally no file.type (MIME) check: files extracted from the dataroom
    // ZIP in the browser arrive with empty/generic MIME (e.g.
    // application/octet-stream), so MIME-based rejection blocks legitimate PDFs.
    // The extension allowlist above — re-enforced server-side in
    // UploadDocumentUseCase — is the reliable gate.

    const backendFormData = new FormData()
    backendFormData.append('file', file)

    const companyId = formData.get('companyId')
    if (typeof companyId === 'string' && companyId.length > 0) {
      if (!/^[a-zA-Z0-9_-]{1,200}$/.test(companyId)) {
        return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
      }
      backendFormData.append('companyId', companyId)
    }

    const response = await fetch(`${baseUrl}/automation/${automationId}/upload-document`, {
      method: 'POST',
      headers: { ...authHeaders },
      body: backendFormData,
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
