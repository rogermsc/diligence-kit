import { Injectable } from '@nestjs/common';
import { ChunkUploadProgress, ChunkUploadProgressTracker } from '../../domain/interfaces/chunk-metadata.interface';

@Injectable()
export class InMemoryUploadProgressTracker implements ChunkUploadProgressTracker {
    private activeUploads: Map<string, ChunkUploadProgress> = new Map();
    private readonly STALE_UPLOAD_CLEANUP_INTERVAL = 1000 * 60 * 30; // 30 minutos
    private readonly UPLOAD_TIMEOUT = 1000 * 60 * 60; // 1 hora

    constructor() {
        setInterval(() => this.cleanupStaleUploads(), this.STALE_UPLOAD_CLEANUP_INTERVAL);
    }

    trackProgress(progress: ChunkUploadProgress): void {
        this.activeUploads.set(progress.uploadId, {
            ...progress,
            lastUploadActivity: new Date()
        });
    }

    getProgress(uploadId: string): ChunkUploadProgress | undefined {
        return this.activeUploads.get(uploadId);
    }

    removeProgress(uploadId: string): void {
        this.activeUploads.delete(uploadId);
    }

    cleanupStaleUploads(): void {
        const now = new Date().getTime();
        for (const [uploadId, progress] of this.activeUploads.entries()) {
            const timeSinceLastActivity = now - progress.lastUploadActivity.getTime();
            if (timeSinceLastActivity > this.UPLOAD_TIMEOUT) {
                this.activeUploads.delete(uploadId);
            }
        }
    }
} 