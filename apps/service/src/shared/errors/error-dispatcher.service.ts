import { ApplicationError } from "@/shared/errors/errors"
import { ErrorType } from "@/shared/errors/types"
import { Injectable, Logger } from "@nestjs/common"
@Injectable()
export class ErrorDispatcherService {
    private readonly logger = new Logger(ErrorDispatcherService.name)

    dispatch(error: unknown): ApplicationError<ErrorType> {
        if (error instanceof ApplicationError) {
            return error
        }

        return new ApplicationError({
            message: "Internal Server Error",
            code: 500,
            type: ErrorType.INTERNAL_SERVER_ERROR,
        })
    }

    // Método auxiliar para erros específicos de negócio
    dispatchBusinessError(error: unknown, context: string) {
        const response = this.dispatch(error)

        this.logger.warn({
            context,
            ...response,
        })

        return response
    }

    // Método auxiliar para erros de integração
    dispatchIntegrationError(error: unknown, integration: string) {
        const response = this.dispatch(error)

        this.logger.error({
            integration,
            ...response,
            isIntegrationError: true,
        })

        return response
    }
}
