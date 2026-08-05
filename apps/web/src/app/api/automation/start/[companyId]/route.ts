import { NextRequest, NextResponse } from "next/server";
import { getAuthHeaders, createUnauthorizedResponse, getBaseUrl } from "@/lib/auth-server";

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'text/csv', 'text/plain',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/zip', 'application/x-zip-compressed', 'application/octet-stream',
  'image/png', 'image/jpeg', 'image/tiff', 'image/bmp', 'image/webp',
]);

const ALLOWED_EXTENSIONS = new Set([
  'pdf', 'csv', 'xls', 'xlsx', 'doc', 'docx', 'txt',
  'ppt', 'pptx', 'zip',
  'png', 'jpg', 'jpeg', 'tiff', 'tif', 'bmp', 'webp',
]);

const MAX_CHUNK_SIZE = 10 * 1024 * 1024; // 10 MB
const MAX_TOTAL_SIZE = 500 * 1024 * 1024; // 500 MB

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string }> }
) {
  try {
    const { companyId } = await params;

    if (!/^[a-zA-Z0-9_-]{1,200}$/.test(companyId)) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    const authHeaders = await getAuthHeaders();
    if (!authHeaders) {
      return createUnauthorizedResponse();
    }

    const formData = await request.formData();
    const baseUrl = getBaseUrl();

    const chunkNumber = formData.get("chunkNumber");
    const totalChunks = formData.get("totalChunks");
    const identifier = formData.get("identifier");
    const filename = formData.get("filename");
    const totalSize = formData.get("totalSize");

    // Validate chunk parameters
    if (chunkNumber !== null && !/^\d+$/.test(String(chunkNumber))) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }
    if (totalChunks !== null && !/^\d+$/.test(String(totalChunks))) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }
    if (identifier !== null && !/^[a-zA-Z0-9_-]{1,200}$/.test(String(identifier))) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }
    if (totalSize !== null && Number(totalSize) > MAX_TOTAL_SIZE) {
      return NextResponse.json({ error: 'File too large' }, { status: 413 });
    }

    // Validate filename (prevent path traversal)
    if (filename !== null) {
      const name = String(filename);
      if (name.includes('..') || name.includes('/') || name.includes('\\')) {
        return NextResponse.json({ error: 'Invalid filename' }, { status: 400 });
      }
      const ext = name.split('.').pop()?.toLowerCase() ?? '';
      if (!ALLOWED_EXTENSIONS.has(ext)) {
        return NextResponse.json({ error: 'File type not allowed' }, { status: 415 });
      }
    }

    // Validate file chunk
    const file = formData.get("file");
    if (file instanceof File) {
      if (file.size > MAX_CHUNK_SIZE) {
        return NextResponse.json({ error: 'Chunk too large' }, { status: 413 });
      }
      if (file.type && !ALLOWED_MIME_TYPES.has(file.type)) {
        return NextResponse.json({ error: 'File type not allowed' }, { status: 415 });
      }
    }

    const backendFormData = new FormData();
    if (file) backendFormData.append("file", file);
    if (chunkNumber) backendFormData.append("chunkNumber", chunkNumber);
    if (totalChunks) backendFormData.append("totalChunks", totalChunks);
    if (identifier) backendFormData.append("identifier", identifier);
    if (filename) backendFormData.append("filename", filename);
    if (totalSize) backendFormData.append("totalSize", totalSize);

    const response = await fetch(`${baseUrl}/automation/start/${companyId}`, {
      method: "POST",
      headers: { ...authHeaders },
      body: backendFormData,
    });

    if (!response.ok) {
      console.error("[API] automation/start error:", response.status);
      return NextResponse.json({ error: "Request failed" }, { status: response.status });
    }

    if (!chunkNumber || chunkNumber === totalChunks) {
      return NextResponse.json(await response.json());
    }

    return NextResponse.json({ status: "chunk_received", chunk: chunkNumber });
  } catch (error) {
    console.error("[API] Error processing request:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
