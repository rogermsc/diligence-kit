import { Injectable, Logger } from '@nestjs/common';
import { RequestValidator } from '@/shared/validators/request-validator';
import { chunkUploadSchema } from '../data/dtos/chunk-upload.schema';
import { ChunkValidationError } from '../domain/errors/automation-event-errors';

@Injectable()
export class ChunkValidator {
    private readonly logger = new Logger(ChunkValidator.name);

    validate(chunkData: unknown) {
        this.logger.debug('Validating chunk data', { chunkData });

        try {
            const validatedData = RequestValidator.validate(chunkData, chunkUploadSchema);

            return validatedData;
        } catch (error) {
            this.logger.error('Chunk validation failed', {
                chunkData,
                error: error.message
            });
            throw new ChunkValidationError(chunkData, error.message);
        }
    }

    isLastChunk(chunkData: any): boolean {
        return chunkData.chunkNumber === chunkData.totalChunks;
    }
} 