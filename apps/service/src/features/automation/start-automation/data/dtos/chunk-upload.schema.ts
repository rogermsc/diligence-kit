import { z } from "zod"

const numberFromString = z
    .union([z.string(), z.number()])
    .transform((val) => Number(val))
    .pipe(z.number().int().positive())

export const chunkUploadSchema = z.object({
    chunkNumber: numberFromString,
    totalChunks: numberFromString,
    identifier: z.string().max(255),
    filename: z.string().max(500),
    totalSize: numberFromString,
})

export type ChunkUploadInput = z.infer<typeof chunkUploadSchema>

export interface ChunkUploadOutput {
    status: "chunk_received" | "upload_complete"
    chunk?: number
    automation?: any
    agentResponse?: string
    documents?: any[]
}
