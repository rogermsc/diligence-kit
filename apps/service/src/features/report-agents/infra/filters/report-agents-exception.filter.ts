import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus, Logger } from '@nestjs/common'
import { Response } from 'express'
import { 
    AutomationNotFoundError, 
    InvalidAutomationStageError, 
    DiligenceCreationFailedError 
} from '../../domain/errors/report-agent.errors'

type ReportAgentsError = AutomationNotFoundError | InvalidAutomationStageError | DiligenceCreationFailedError

@Catch(AutomationNotFoundError, InvalidAutomationStageError, DiligenceCreationFailedError)
export class ReportAgentsExceptionFilter implements ExceptionFilter {
    private readonly logger = new Logger(ReportAgentsExceptionFilter.name)

    catch(exception: ReportAgentsError, host: ArgumentsHost) {
        const ctx = host.switchToHttp()
        const response = ctx.getResponse<Response>()
        const request = ctx.getRequest()

        // Log da exceção com contexto
        this.logger.error({
            message: "Report Agents Exception Caught",
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
                ip: request.ip,
            },
            timestamp: new Date().toISOString(),
        })

        // Mapear erros específicos para respostas HTTP apropriadas
        const errorResponse = this.mapErrorToResponse(exception)

        return response.status(errorResponse.statusCode).json(errorResponse.body)
    }

    private mapErrorToResponse(exception: ReportAgentsError) {
        switch (exception.constructor) {
            case AutomationNotFoundError:
                return {
                    statusCode: HttpStatus.NOT_FOUND,
                    body: {
                        statusCode: HttpStatus.NOT_FOUND,
                        message: 'Automation not found.',
                        type: exception.type
                    }
                }

            case InvalidAutomationStageError:
                return {
                    statusCode: HttpStatus.CONFLICT,
                    body: {
                        statusCode: HttpStatus.CONFLICT,
                        message: 'Cannot trigger second stage yet.',
                        type: exception.type
                    }
                }

            case DiligenceCreationFailedError:
                return {
                    statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
                    body: {
                        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
                        message: 'Internal server error.',
                        type: exception.type
                    }
                }

            default:
                return {
                    statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
                    body: {
                        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
                        message: 'Internal server error.',
                        type: 'UNKNOWN_ERROR'
                    }
                }
        }
    }
}