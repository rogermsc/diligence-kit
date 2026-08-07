import { applyDecorators } from "@nestjs/common"
import {
    ApiOperation,
    ApiParam,
    ApiResponse,
    ApiProduces,
} from "@nestjs/swagger"

export const ApiGetDocumentsByAutomationId = () => {
    return applyDecorators(
        ApiOperation({
            summary: "Get documents by automation ID",
            description:
                "Retrieve all documents associated with a specific automation process",
        }),
        ApiParam({
            name: "automationId",
            description: "ID of the automation to get documents for",
            type: "string",
            example: "clxyz789def456abc123",
        }),
        ApiResponse({
            status: 200,
            description: "Documents retrieved successfully",
            schema: {
                type: "object",
                properties: {
                    documents: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                id: {
                                    type: "string",
                                    example: "cldoc123abc456def789",
                                },
                                name: {
                                    type: "string",
                                    example: "financial_report.pdf",
                                },
                                bucketPath: {
                                    type: "string",
                                    example:
                                        "company-xyz/automation-123/financial_report.pdf",
                                },
                                createdAt: {
                                    type: "string",
                                    format: "date-time",
                                },
                                automationId: {
                                    type: "string",
                                    example: "clxyz789def456abc123",
                                },
                            },
                        },
                    },
                },
            },
        }),
        ApiResponse({
            status: 401,
            description:
                "Unauthorized - Invalid or missing authentication token",
        }),
        ApiResponse({ status: 404, description: "Automation not found" }),
    )
}

export const ApiDownloadDocument = () => {
    return applyDecorators(
        ApiOperation({
            summary: "Download a specific document",
            description:
                "Download a document file by its ID. Returns the file as a stream.",
        }),
        ApiProduces("application/octet-stream"),
        ApiParam({
            name: "documentId",
            description: "ID of the document to download",
            type: "string",
            example: "cldoc123abc456def789",
        }),
        ApiResponse({
            status: 200,
            description: "File downloaded successfully",
            schema: {
                type: "string",
                format: "binary",
                description: "Document file content as binary stream",
            },
            headers: {
                "Content-Type": {
                    description: "MIME type of the downloaded file",
                    schema: { type: "string", example: "application/pdf" },
                },
                "Content-Disposition": {
                    description: "Attachment information with filename",
                    schema: {
                        type: "string",
                        example: 'attachment; filename="document.pdf"',
                    },
                },
                "Content-Length": {
                    description: "Size of the file in bytes",
                    schema: { type: "string", example: "1048576" },
                },
            },
        }),
        ApiResponse({
            status: 401,
            description:
                "Unauthorized - Invalid or missing authentication token",
        }),
        ApiResponse({ status: 404, description: "Document not found" }),
        ApiResponse({
            status: 500,
            description: "Error accessing file storage",
        }),
    )
}

export const ApiDownloadOnePager = () => {
    return applyDecorators(
        ApiOperation({
            summary: "Download automation one-pager report",
            description:
                "Download the generated one-pager summary report for a completed automation process",
        }),
        ApiProduces("application/pdf"),
        ApiParam({
            name: "automationId",
            description: "ID of the automation to download one-pager for",
            type: "string",
            example: "clxyz789def456abc123",
        }),
        ApiResponse({
            status: 200,
            description: "One-pager downloaded successfully",
            schema: {
                type: "string",
                format: "binary",
                description: "One-pager PDF file content as binary stream",
            },
            headers: {
                "Content-Type": {
                    description: "MIME type of the downloaded file",
                    schema: { type: "string", example: "application/pdf" },
                },
                "Content-Disposition": {
                    description: "Attachment information with filename",
                    schema: {
                        type: "string",
                        example: 'attachment; filename="company_one_pager.pdf"',
                    },
                },
                "Content-Length": {
                    description: "Size of the file in bytes",
                    schema: { type: "string", example: "2097152" },
                },
            },
        }),
        ApiResponse({
            status: 401,
            description:
                "Unauthorized - Invalid or missing authentication token",
        }),
        ApiResponse({
            status: 404,
            description: "Automation or one-pager not found",
        }),
        ApiResponse({
            status: 422,
            description:
                "Automation not completed yet - one-pager not available",
        }),
        ApiResponse({
            status: 500,
            description: "Error accessing file storage",
        }),
    )
}

export const ApiDownloadReport = () => {
    return applyDecorators(
        ApiOperation({
            summary: "Download automation report",
            description:
                "Download the generated comprehensive report for a completed automation process",
        }),
        ApiProduces("application/pdf"),
        ApiParam({
            name: "automationId",
            description: "ID of the automation to download report for",
            type: "string",
            example: "clxyz789def456abc123",
        }),
        ApiResponse({
            status: 200,
            description: "Report downloaded successfully",
            schema: {
                type: "string",
                format: "binary",
                description: "Report PDF file content as binary stream",
            },
            headers: {
                "Content-Type": {
                    description: "MIME type of the downloaded file",
                    schema: { type: "string", example: "application/pdf" },
                },
                "Content-Disposition": {
                    description: "Attachment information with filename",
                    schema: {
                        type: "string",
                        example: 'attachment; filename="automation_report.pdf"',
                    },
                },
                "Content-Length": {
                    description: "Size of the file in bytes",
                    schema: { type: "string", example: "3145728" },
                },
            },
        }),
        ApiResponse({
            status: 401,
            description:
                "Unauthorized - Invalid or missing authentication token",
        }),
        ApiResponse({
            status: 404,
            description: "Automation or report not found",
        }),
        ApiResponse({
            status: 422,
            description: "Automation not completed yet - report not available",
        }),
        ApiResponse({
            status: 500,
            description: "Error accessing file storage",
        }),
    )
}
