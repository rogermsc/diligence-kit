import { z } from "zod"
import { AutomationStatus } from "@/shared/domain/entities/automation.entity"

const SerializedFileSchema = z.object({
    originalname: z.string().max(500),
    mimetype: z.string().max(100),
    size: z.number().int().nonnegative(),
    buffer: z.string(),
    encoding: z.string().max(50),
    fieldname: z.string().max(100),
})

const ChunkMetadataSchema = z.object({
    filename: z.string().max(500),
    totalSize: z.number().int().nonnegative(),
})

export const ChunkRegisteredEventSchema = z.object({
    uploadId: z.string().uuid(),
    chunkNumber: z.number().int().nonnegative(),
    totalChunks: z.number().int().positive(),
    file: SerializedFileSchema,
    metadata: ChunkMetadataSchema,
    companyId: z.string().uuid(),

    automationId: z.string(),
    timestamp: z.coerce.date(),
    registeredAt: z.coerce.date(),
})

export const ChunkQueuedForRetryEventSchema = z.object({
    uploadId: z.string().uuid(),
    chunkNumber: z.number().int().nonnegative(),
    totalChunks: z.number().int().positive(),
    file: SerializedFileSchema,
    metadata: ChunkMetadataSchema,
    companyId: z.string().uuid(),

    automationId: z.string().optional(),
    retryAttempt: z.number().int().nonnegative(),
    nextRetryAt: z.coerce.date(),
    reason: z.string().max(500),
    missingChunks: z.array(z.number().int().nonnegative()),
    timestamp: z.coerce.date(),
})

export const ChunkRetryAttemptEventSchema = z.object({
    uploadId: z.string().uuid(),
    chunkNumber: z.number().int().nonnegative(),
    totalChunks: z.number().int().positive(),
    file: SerializedFileSchema,
    metadata: ChunkMetadataSchema,
    companyId: z.string().uuid(),

    automationId: z.string().optional(),
    retryAttempt: z.number().int().nonnegative(),
    maxRetries: z.number().int().positive(),
    delayMs: z.number().int().nonnegative(),
    previousError: z.string().max(1000).optional(),
    timestamp: z.coerce.date(),
})

export const UploadReadyForAssemblyEventSchema = z.object({
    uploadId: z.string().uuid(),
    totalChunks: z.number().int().positive(),
    confirmedChunks: z.array(z.number().int().nonnegative()),
    originalFilename: z.string().max(500),
    totalSize: z.number().int().nonnegative(),
    companyId: z.string().uuid(),
    companyName: z.string().max(500),
    automationId: z.string().uuid(),

    readyAt: z.coerce.date(),
    timestamp: z.coerce.date(),
})

const StorageUploadedFileSchema = z.object({
    url: z.string(),
    path: z.string(),
    name: z.string().max(500),
})

const DocumentEntitySchema = z.object({
    id: z.string().uuid(),
    automationId: z.string().uuid(),
    name: z.string().max(500),
    bucketPath: z.string(),
    createdAt: z.coerce.date(),
    updatedAt: z.coerce.date(),
    openaiFileId: z.string().optional(),
})

export const ZipAssembledEventSchema = z.object({
    automationId: z.string().uuid(),
    companyId: z.string().uuid(),
    companyName: z.string().max(500),
    zipFile: z.object({
        originalname: z.string().max(500),
        mimetype: z.string().max(100),
        size: z.number().int().nonnegative(),
        buffer: z.undefined().optional(),
        encoding: z.string().max(50),
        fieldname: z.string().max(100),
        uploadedFiles: z.array(StorageUploadedFileSchema),
        totalFiles: z.number().int().nonnegative(),
    }),

    timestamp: z.coerce.date(),
})

export const DocumentsUploadedEventSchema = z.object({
    automationId: z.string().uuid(),
    companyId: z.string().uuid(),
    companyName: z.string().max(500),
    uploadResult: z.object({
        uploadedFiles: z.array(StorageUploadedFileSchema),
        documents: z.array(DocumentEntitySchema),
    }),

    timestamp: z.coerce.date(),
})

export const AgentNotificationEventSchema = z.object({
    automationId: z.string().uuid(),
    companyId: z.string().uuid(),
    companyName: z.string().max(500),
    documents: z.array(DocumentEntitySchema),

    timestamp: z.coerce.date(),
})

export const AutomationUpdatedEventSchema = z.object({
    automationId: z.string().uuid(),
    status: z.nativeEnum(AutomationStatus),
})
