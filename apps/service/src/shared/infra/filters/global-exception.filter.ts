import { ArgumentsHost, Catch, ExceptionFilter, Logger } from "@nestjs/common"
import { Response } from "express"
import { ErrorDispatcherService } from "@/shared/errors/error-dispatcher.service"
import { ApplicationError } from "@/shared/errors/errors"

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
    private readonly logger = new Logger(GlobalExceptionFilter.name)

    constructor(private readonly errorDispatcher: ErrorDispatcherService) {}

    catch(exception: unknown, host: ArgumentsHost) {
        // Se for ApplicationError, não tratar aqui - deixar o ApplicationExceptionFilter tratar
        if (exception instanceof ApplicationError) {
            return
        }

        const ctx = host.switchToHttp()
        const response = ctx.getResponse<Response>()
        const request = ctx.getRequest()

        // Log da exceção não tratada com contexto completo
        this.logger.error({
            message: "Unhandled Exception Caught",
            exception: {
                name: exception instanceof Error ? exception.name : "Unknown",
                message:
                    exception instanceof Error
                        ? exception.message
                        : String(exception),
                stack: exception instanceof Error ? exception.stack : undefined,
                constructor: exception?.constructor?.name,
            },
            request: {
                method: request.method,
                url: request.url,
                params: request.params,
                query: request.query,
                headers: {
                    "user-agent": request.headers["user-agent"],
                    "content-type": request.headers["content-type"],
                },
                ip: request.ip,
            },
            timestamp: new Date().toISOString(),
        })

        // Usar o ErrorDispatcher para tratar a exceção
        const handledError = this.errorDispatcher.dispatch(exception)

        return response.status(handledError.code).json({
            statusCode: handledError.code,
            message: handledError.message,
            type: handledError.type,
        })
    }
}
