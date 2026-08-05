import { ApplicationError, ValidationError } from "@/shared/errors/errors"
import { ArgumentsHost, Catch, ExceptionFilter, Logger } from "@nestjs/common"
import { Response } from "express"
import { ErrorDispatcherService } from "src/shared/errors/error-dispatcher.service"

@Catch(ApplicationError)
export class ApplicationExceptionFilter implements ExceptionFilter {
    private readonly logger = new Logger(ApplicationExceptionFilter.name)

    constructor(private readonly errorDispatcher: ErrorDispatcherService) {}

    catch(exception: ApplicationError<any>, host: ArgumentsHost) {
        const ctx = host.switchToHttp()
        const response = ctx.getResponse<Response>()
        const request = ctx.getRequest()

        // Log da exceção com contexto completo
        this.logger.error({
            message: "Application Exception Caught",
            exception: {
                message: exception.message,
                code: exception.code,
                type: exception.type,
                stack: exception.stack,
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

        if (exception instanceof ValidationError) {
            return response.status(exception.code).json({
                statusCode: exception.code,
                message: exception.message,
                type: exception.type,
                errors: exception.errors,
            })
        }

        return response.status(exception.code).json({
            statusCode: exception.code,
            message: exception.message,
            type: exception.type,
        })
    }
}
