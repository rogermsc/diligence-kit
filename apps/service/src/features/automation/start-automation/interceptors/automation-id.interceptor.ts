import {
    Injectable,
    NestInterceptor,
    ExecutionContext,
    CallHandler,
    Logger,
} from "@nestjs/common"
import { Observable } from "rxjs"
import { randomUUID } from "crypto"
import { ChunkValidator } from "../services/chunk-validator.service"
import { AutomationRequest } from "../types/request.types"

@Injectable()
export class AutomationIdInterceptor implements NestInterceptor {
    private readonly logger = new Logger(AutomationIdInterceptor.name)

    constructor(private readonly chunkValidator: ChunkValidator) {}

    intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
        const request = context.switchToHttp().getRequest<AutomationRequest>()

        this.logger.log(
            `INTERCEPTOR AutomationIdInterceptor executado para rota: ${request.path}`,
            {
                method: request.method,
                path: request.path,
                originalUrl: request.originalUrl,
            },
        )

        // Só processar para a rota de start automation
        if (!request.path.includes("/start/") || request.method !== "POST") {
            this.logger.log(
                `INTERCEPTOR Ignorando rota: ${request.path} ${request.method}`,
            )
            return next.handle()
        }

        try {
            this.logger.log(`INTERCEPTOR Body recebido:`, {
                hasFile: !!(request as any).file,
                contentType: request.headers["content-type"],
            })

            // Validar os dados do chunk
            const validatedChunkData = this.chunkValidator.validate(
                request.body,
            )

            this.logger.log(`INTERCEPTOR Chunk validado:`, {
                chunkNumber: validatedChunkData.chunkNumber,
                totalChunks: validatedChunkData.totalChunks,
                identifier: validatedChunkData.identifier,
            })

            // Verificar se é o último chunk
            const isLastChunk =
                this.chunkValidator.isLastChunk(validatedChunkData)

            this.logger.log(`INTERCEPTOR É último chunk? ${isLastChunk}`)

            if (isLastChunk) {
                // Gerar UUID aleatório para o automation ID
                const automationId = randomUUID()

                // Adicionar o automation ID ao request para uso posterior
                request.automationId = automationId

                this.logger.log(
                    `INTERCEPTOR Generated automation ID for last chunk: ${automationId}`,
                    {
                        chunkNumber: validatedChunkData.chunkNumber,
                        totalChunks: validatedChunkData.totalChunks,
                        identifier: validatedChunkData.identifier,
                    },
                )
            }
        } catch (error) {
            this.logger.error(`INTERCEPTOR Erro na validação:`, error)
            // Se houver erro na validação, apenas continua sem gerar ID
            // O controller tratará a validação novamente
        }

        return next.handle()
    }
}
