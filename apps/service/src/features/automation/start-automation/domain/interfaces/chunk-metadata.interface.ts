export interface ChunkUploadProgress {
    uploadId: string;
    originalFilename: string;
    expectedTotalSize: number;
    expectedTotalChunks: number;
    processedChunks: Set<number>;
    lastUploadActivity: Date;
}

export interface ChunkUploadProgressTracker {
    trackProgress(progress: ChunkUploadProgress): void;
    getProgress(uploadId: string): ChunkUploadProgress | undefined;
    removeProgress(uploadId: string): void;
    cleanupStaleUploads(): void;
} 