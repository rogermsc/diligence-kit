import { AutomationStatus } from "@/shared/domain/entities/automation.entity"
import { File as MulterFile } from "multer"

// Interface para arquivo serializável
export interface SerializedFile {
    originalname: string
    mimetype: string
    size: number
    buffer: string // base64 string
    encoding: string
    fieldname: string
}

export interface ChunkReceivedEvent {
    file: SerializedFile
    metadata: {
        chunkNumber: number
        totalChunks: number
        identifier: string
        filename: string
        totalSize: number
    }
    companyId: string
    timestamp: Date
}

export interface AutomationCreatedEvent {
    automationId: string
    companyId: string
    companyName: string
    chunkIdentifier: string
    metadata: {
        totalChunks: number
        filename: string
    }
    timestamp: Date
}

export interface AutomationUpdatedEvent {
    automationId: string
    status: AutomationStatus
}

export interface ZipAssembledEvent {
    automationId: string
    companyId: string
    companyName: string
    zipFile: {
        originalname: string
        mimetype: string
        size: number
        buffer?: undefined // Não mais usado - arquivos já estão no bucket
        encoding: string
        fieldname: string
        uploadedFiles: any[] // Lista de arquivos já processados no bucket
        totalFiles: number // Quantidade total de arquivos extraídos
    }
    timestamp: Date
}

export interface DocumentsUploadedEvent {
    automationId: string
    companyId: string
    companyName: string
    uploadResult: {
        uploadedFiles: any[]
        documents: any[]
    }
    timestamp: Date
}

export interface AgentNotificationEvent {
    automationId: string
    companyId: string
    companyName: string
    documents: any[]
    timestamp: Date
}

// ==================== NEW CHUNK INTEGRITY EVENTS ====================

export interface ChunkRegisteredEvent {
    uploadId: string
    chunkNumber: number
    totalChunks: number
    file: SerializedFile
    metadata: {
        filename: string
        totalSize: number
    }
    companyId: string
    automationId: string // Pode estar vazio se não for o primeiro chunk
    timestamp: Date
    registeredAt: Date
}

export interface ChunkQueuedForRetryEvent {
    uploadId: string
    chunkNumber: number
    totalChunks: number
    file: SerializedFile // manter o arquivo para reprocessar
    metadata: {
        filename: string
        totalSize: number
    }
    companyId: string
    automationId?: string
    retryAttempt: number
    nextRetryAt: Date
    reason: string
    missingChunks: number[]
    timestamp: Date
}

export interface ChunkConfirmedEvent {
    uploadId: string
    chunkNumber: number
    totalChunks: number
    bucketPath: string
    fileSize: number
    confirmedAt: Date
    timestamp: Date
}

export interface ChunkRetryAttemptEvent {
    uploadId: string
    chunkNumber: number
    totalChunks: number
    file: SerializedFile // payload completo para reprocessar
    metadata: {
        filename: string
        totalSize: number
    }
    companyId: string
    automationId?: string
    retryAttempt: number
    maxRetries: number
    delayMs: number
    previousError?: string
    timestamp: Date
}

export interface UploadReadyForAssemblyEvent {
    uploadId: string
    totalChunks: number
    confirmedChunks: number[]
    originalFilename: string
    totalSize: number
    companyId: string
    companyName: string
    automationId: string
    readyAt: Date
    timestamp: Date
}
