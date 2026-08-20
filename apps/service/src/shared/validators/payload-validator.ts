import { z, ZodError, ZodSchema } from "zod"
import { Logger } from "@nestjs/common"
import { ValidationError } from "@/shared/errors/errors"
import { ValidationErrorDescription } from "@/shared/errors/types"

/**
 * What a payload looks like, without what it contains.
 *
 * The agent's `analysis` payload carries verbatim excerpts from a client's
 * dataroom. Logging the payload itself on a validation failure copies those
 * quotes into the log sink — which in production is Cloud Logging, the sink the
 * liaison agent reads back. The field names and the Zod issue paths are what a
 * reader actually needs to diagnose a shape mismatch; the values are not.
 */
function shape(value: unknown): string {
    if (value === null || value === undefined) return String(value)
    if (Array.isArray(value)) return `array[${value.length}]`
    if (typeof value === "object") {
        return `{${Object.keys(value).sort().join(", ")}}`
    }
    return typeof value
}

export class PayloadValidator {
    private static readonly logger = new Logger(PayloadValidator.name)

    /**
     * Validates payload against a Zod schema and throws custom ValidationError
     * @param data - The data to validate
     * @param schema - The Zod schema to validate against
     * @param context - Optional context for logging (e.g., 'ReportEvent', 'UserRegistration')
     * @returns The validated data
     * @throws ValidationError with detailed error information
     */
    static validate<T>(
        data: unknown,
        schema: ZodSchema<T>,
        context?: string,
    ): T {
        const logContext = context ? `[${context}]` : ""

        try {
            const result = schema.parse(data)

            this.logger.debug(`${logContext} Payload validation successful`, {
                context,
                validatedShape: shape(result),
            })

            return result
        } catch (error) {
            this.logger.error(`${logContext} Payload validation failed`, {
                context,
                receivedShape: shape(data),
            })

            if (error instanceof ZodError) {
                const validationErrors: ValidationErrorDescription[] =
                    error.issues.map((issue) => ({
                        code: issue.code,
                        message: issue.message,
                        field: issue.path.map(String).join(".") || "<root>",
                    }))

                throw new ValidationError({
                    message: `Payload validation failed${context ? ` for ${context}` : ""}`,
                    code: 400,
                    type: "VALIDATION_ERROR",
                    errors: validationErrors,
                })
            }

            // Re-throw other errors
            throw error
        }
    }

    /**
     * Validates payload and returns a result object instead of throwing
     * @param data - The data to validate
     * @param schema - The Zod schema to validate against
     * @param context - Optional context for logging
     * @returns Object with success flag and either data or error
     */
    static validateSafe<T>(
        data: unknown,
        schema: ZodSchema<T>,
        context?: string,
    ):
        | { success: true; data: T }
        | { success: false; error: ValidationError<"VALIDATION_ERROR"> } {
        try {
            const validatedData = this.validate(data, schema, context)
            return { success: true, data: validatedData }
        } catch (error) {
            if (error instanceof ValidationError) {
                return { success: false, error }
            }

            // Convert unexpected errors to ValidationError
            const validationError = new ValidationError({
                message: `Unexpected validation error${context ? ` for ${context}` : ""}`,
                code: 500,
                type: "VALIDATION_ERROR" as const,
                errors: [
                    {
                        code: "unexpected_error",
                        message: error.message || "Unknown error",
                        field: "<unknown>",
                    },
                ],
            })

            return { success: false, error: validationError }
        }
    }

    static validateOrThrow<T>(
        data: unknown,
        schema: ZodSchema<T>,
        errorMessage?: string,
    ): T {
        try {
            return schema.parse(data)
        } catch (error) {
            if (error instanceof ZodError) {
                const fieldErrors = error.issues
                    .map(
                        (issue) =>
                            `${issue.path.join(".") || "root"}: ${issue.message}`,
                    )
                    .join(", ")

                throw new ValidationError({
                    message:
                        errorMessage || `Validation failed: ${fieldErrors}`,
                    code: 400,
                    type: "VALIDATION_ERROR" as const,
                    errors: error.issues.map((issue) => ({
                        code: issue.code,
                        message: issue.message,
                        field: issue.path.map(String).join(".") || "<root>",
                    })),
                })
            }
            throw error
        }
    }

    /**
     * Validates and handles errors with structured logging
     * @param data - The data to validate
     * @param schema - The Zod schema to validate against
     * @param context - Context for logging
     * @param logger - Logger instance
     * @returns The validated data or throws with proper error handling
     */
    static validateWithErrorHandling<T>(
        data: unknown,
        schema: ZodSchema<T>,
        context: string,
        logger: Logger,
    ): T {
        try {
            return this.validate(data, schema, context)
        } catch (error) {
            this.handleValidationError(error, data, context, logger)
            throw error
        }
    }

    /**
     * Handles validation errors with structured logging
     */
    private static handleValidationError(
        error: any,
        payload: unknown,
        context: string,
        logger: Logger,
    ): void {
        const baseErrorInfo = {
            errorType: error.constructor.name,
            errorMessage: error.message,
            receivedShape: shape(payload),
            context,
        }

        if (error instanceof ValidationError) {
            logger.error(`❌ ${context} payload validation error`, {
                ...baseErrorInfo,
                errorCode: error.code,
                customErrorType: error.type,
                validationErrors: error.errors,
            })
        } else if (error.type && error.code) {
            // Handle other ApplicationErrors
            logger.error(`❌ ${context} processing error`, {
                ...baseErrorInfo,
                errorCode: error.code,
                customErrorType: error.type,
                stack: error.stack,
            })
        } else {
            // Handle unexpected errors
            logger.error(`❌ Unexpected error in ${context}`, {
                ...baseErrorInfo,
                stack: error.stack,
            })
        }
    }
}
