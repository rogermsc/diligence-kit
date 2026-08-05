import z, { ZodError, ZodSchema } from "zod"
import { Injectable, Logger, BadRequestException } from "@nestjs/common"
import { ValidationErrorDescription } from "@/shared/errors/types"
import { ApplicationError, ValidationError } from "@/shared/errors/errors"

export class RequestValidator {
    static validate<T>(data: unknown, schema: z.ZodSchema<T>): T {
        const isMissingBody = data === undefined || data === null

        if (isMissingBody) {
            const result = schema.safeParse({})

            if (!result.success) {
                const requiredErrors: ValidationErrorDescription[] =
                    result.error.issues
                        .filter(
                            (issue) =>
                                issue.code === "invalid_type" &&
                                issue.path.length > 0,
                        )
                        .map((issue) => ({
                            code: "400",
                            message: `Required '${issue.path.join(".")}' field.`,
                            field: issue.path.join("."),
                        }))

                throw new ValidationError({
                    message: "Requested fields not provided",
                    code: 400,
                    type: "VALIDATION_ERROR",
                    errors: requiredErrors,
                })
            }
        }

        // Validação normal do Zod
        try {
            return schema.parse(data)
        } catch (error) {
            Logger.debug(error)
            if (error instanceof z.ZodError) {
                const validationErrors: ValidationErrorDescription[] =
                    error.issues.map((e) => ({
                        code: e.code,
                        message: e.message,
                        field: e.path.map(String).join(".") || "<root>",
                    }))

                throw new ValidationError({
                    message: "Erro de validação",
                    code: 400,
                    type: "VALIDATION_ERROR",
                    errors: validationErrors,
                })
            }

            throw new ApplicationError({
                message: "Internal Server Error",
                code: 500,
                type: "INTERNAL_SERVER_ERROR",
            })
        }
    }

    static validateOrThrow(data: unknown, schema: z.ZodSchema<any>) {
        try {
            return schema.parse(data)
        } catch (err) {
            if (err instanceof ZodError) {
                const details = err.errors.map((e) => ({
                    field: e.path.join("."),
                    message: e.message,
                }))
                throw new BadRequestException({
                    message: "Validation failed. All fields are required.",
                    details,
                })
            }
            throw new BadRequestException(
                "An unexpected validation error occurred.",
            )
        }
    }
}
