import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { ChunkValidator } from '../services/chunk-validator.service';
import { AutomationRequest } from '../types/request.types';

@Injectable()
export class AutomationIdMiddleware implements NestMiddleware {
    constructor(private readonly chunkValidator: ChunkValidator) { }

    use(req: AutomationRequest, res: Response, next: NextFunction) {
        Logger.log(`MIDDLEWARE AutomationIdMiddleware executado para rota: ${req.path}`, {
            method: req.method,
            path: req.path,
            originalUrl: req.originalUrl
        });

        // Só processar para a rota de start automation
        if (!req.path.includes('/start/') || req.method !== 'POST') {
            Logger.log(`MIDDLEWARE Ignorando rota: ${req.path} ${req.method}`);
            return next();
        }

        try {
            Logger.log(`MIDDLEWARE Body recebido:`, {
                body: req.body,
                contentType: req.headers['content-type']
            });

            // Validar os dados do chunk
            const validatedChunkData = this.chunkValidator.validate(req.body);

            Logger.log(`MIDDLEWARE Chunk validado:`, {
                chunkNumber: validatedChunkData.chunkNumber,
                totalChunks: validatedChunkData.totalChunks,
                identifier: validatedChunkData.identifier
            });

            // Verificar se é o último chunk
            const isLastChunk = this.chunkValidator.isLastChunk(validatedChunkData);

            Logger.log(`MIDDLEWARE É último chunk? ${isLastChunk}`);

            if (isLastChunk) {
                // Gerar UUID aleatório para o automation ID
                const automationId = randomUUID();

                // Adicionar o automation ID ao request para uso posterior
                req.automationId = automationId;

                Logger.log(`MIDDLEWARE Generated automation ID for last chunk: ${automationId}`, {
                    chunkNumber: validatedChunkData.chunkNumber,
                    totalChunks: validatedChunkData.totalChunks,
                    identifier: validatedChunkData.identifier
                });
            }

            next();
        } catch (error) {
            Logger.error(`MIDDLEWARE Erro na validação:`, error);
            // Se houver erro na validação, apenas continua sem gerar ID
            // O controller tratará a validação novamente
            next();
        }
    }
}