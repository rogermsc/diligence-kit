import { applyDecorators } from "@nestjs/common"
import { ApiOperation, ApiParam, ApiResponse } from "@nestjs/swagger"

export const ApiTriggerSecondStage = () => {
    return applyDecorators(
        ApiOperation({
            summary: "Trigger second stage of automation",
            description:
                "Triggers the second stage (diligence) of an automation that has completed the triage stage",
        }),
        ApiParam({
            name: "automationId",
            description:
                "The UUID of the automation to trigger second stage for",
            type: "string",
            format: "uuid",
        }),
        ApiResponse({
            status: 202,
            description: "Second stage successfully queued",
            schema: {
                type: "object",
                properties: {
                    automationId: { type: "string", format: "uuid" },
                    status: { type: "string", example: "queued" },
                },
            },
        }),
        ApiResponse({
            status: 400,
            description: "Invalid automationId format",
            schema: {
                type: "object",
                properties: {
                    message: {
                        type: "string",
                        example: "Invalid automationId format.",
                    },
                },
            },
        }),
        ApiResponse({
            status: 404,
            description: "Automation not found",
            schema: {
                type: "object",
                properties: {
                    message: {
                        type: "string",
                        example: "Automation not found.",
                    },
                },
            },
        }),
        ApiResponse({
            status: 409,
            description: "Cannot trigger second stage yet",
            schema: {
                type: "object",
                properties: {
                    message: {
                        type: "string",
                        example: "Cannot trigger second stage yet.",
                    },
                },
            },
        }),
        ApiResponse({
            status: 500,
            description: "Internal Server Error",
            schema: {
                type: "object",
                properties: {
                    message: {
                        type: "string",
                        example: "Internal server error.",
                    },
                },
            },
        }),
    )
}
