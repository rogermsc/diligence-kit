import { File } from "@/shared/domain/entities/file.entity"
import { File as MulterFile } from "multer"

export interface ChunkMetadata {
    chunkNumber: number
    totalChunks: number
    identifier: string
    filename: string
    totalSize: number
    receivedChunks: Set<number>
    lastActivity: Date
}

export interface ChunkUploadResult {
    isComplete: boolean
    chunkNumber: number
}

export interface IChunkManager {
    handleChunk(
        file: MulterFile,
        chunkNumber: number,
        totalChunks: number,
        identifier: string,
        filename: string,
        totalSize: number,
    ): Promise<ChunkUploadResult>

    assembleFile(identifier: string): Promise<File>

    cleanupChunks(identifier: string): Promise<void>
}
