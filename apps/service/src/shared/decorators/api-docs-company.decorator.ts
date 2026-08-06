import { applyDecorators } from "@nestjs/common"
import { ApiOperation, ApiParam, ApiBody, ApiResponse } from "@nestjs/swagger"

export const ApiCreateCompany = () => {
    return applyDecorators(
        ApiOperation({
            summary: "Create a new company",
            description: "Create a new company with the provided information",
        }),
        ApiBody({
            description: "Company creation data",
            schema: {
                type: "object",
                properties: {
                    name: { type: "string", example: "Tech Innovations Inc." },
                    description: {
                        type: "string",
                        example: "A cutting-edge technology company",
                    },
                    website: {
                        type: "string",
                        example: "https://www.techinnovations.com",
                    },
                    sector: { type: "string", example: "Technology" },
                },
                required: ["name"],
            },
        }),
        ApiResponse({
            status: 201,
            description: "Company created successfully",
            schema: {
                type: "object",
                properties: {
                    id: { type: "string", example: "clxyz123abc456def789" },
                    name: { type: "string", example: "Tech Innovations Inc." },
                    status: { type: "string", example: "ACTIVE" },
                    createdAt: { type: "string", format: "date-time" },
                },
            },
        }),
        ApiResponse({ status: 400, description: "Invalid input data" }),
        ApiResponse({ status: 401, description: "Unauthorized" }),
        ApiResponse({ status: 409, description: "Company already exists" }),
    )
}

export const ApiListCompanies = () => {
    return applyDecorators(
        ApiOperation({
            summary: "List all companies",
            description: "Retrieve a list of all companies in the system",
        }),
        ApiResponse({
            status: 200,
            description: "Companies retrieved successfully",
            schema: {
                type: "object",
                properties: {
                    companies: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                id: {
                                    type: "string",
                                    example: "clxyz123abc456def789",
                                },
                                name: {
                                    type: "string",
                                    example: "Tech Innovations Inc.",
                                },
                                status: { type: "string", example: "ACTIVE" },
                                createdAt: {
                                    type: "string",
                                    format: "date-time",
                                },
                            },
                        },
                    },
                },
            },
        }),
        ApiResponse({ status: 401, description: "Unauthorized" }),
    )
}

export const ApiGetCompanyDetails = () => {
    return applyDecorators(
        ApiOperation({
            summary: "Get company details",
            description:
                "Retrieve detailed information about a specific company",
        }),
        ApiParam({
            name: "companyId",
            description: "ID of the company to retrieve",
            type: "string",
            example: "clxyz123abc456def789",
        }),
        ApiResponse({
            status: 200,
            description: "Company details retrieved successfully",
            schema: {
                type: "object",
                properties: {
                    id: { type: "string", example: "clxyz123abc456def789" },
                    name: { type: "string", example: "Tech Innovations Inc." },
                    description: {
                        type: "string",
                        example: "A cutting-edge technology company",
                    },
                    website: {
                        type: "string",
                        example: "https://www.techinnovations.com",
                    },
                    sector: { type: "string", example: "Technology" },
                    status: { type: "string", example: "ACTIVE" },
                    createdAt: { type: "string", format: "date-time" },
                    updatedAt: { type: "string", format: "date-time" },
                },
            },
        }),
        ApiResponse({ status: 401, description: "Unauthorized" }),
        ApiResponse({ status: 404, description: "Company not found" }),
    )
}

export const ApiGetCompanyOnePager = () => {
    return applyDecorators(
        ApiOperation({
            summary: "Download company one-pager PDF",
            description:
                "Downloads the one-pager PDF file from the most recent completed triage automation",
        }),
        ApiParam({
            name: "automationId",
            description: "Triage Automation ID",
            type: "string",
        }),
        ApiResponse({
            status: 200,
            description: "One-pager PDF file downloaded successfully",
            content: {
                "application/pdf": {
                    schema: {
                        type: "string",
                        format: "binary",
                    },
                },
            },
            headers: {
                "Content-Disposition": {
                    description: "Attachment with filename",
                    schema: {
                        type: "string",
                        example: 'attachment; filename="one-pager.pdf"',
                    },
                },
                "Content-Type": {
                    description: "MIME type of the file",
                    schema: {
                        type: "string",
                        example: "application/pdf",
                    },
                },
            },
        }),
        ApiResponse({ status: 401, description: "Unauthorized" }),
        ApiResponse({
            status: 404,
            description: "Company or one-pager not found",
        }),
    )
}

export const ApiDeleteCompany = () => {
    return applyDecorators(
        ApiOperation({
            summary: "Delete a company",
            description:
                "Permanently delete a company and all related data (automations, documents, results, reports, one-pagers). Data in Qdrant and Cloud Storage will remain.",
        }),
        ApiParam({
            name: "id",
            description: "ID of the company to delete",
            type: "string",
            example: "clxyz123abc456def789",
        }),
        ApiResponse({
            status: 200,
            description: "Company deleted successfully",
            schema: {
                type: "object",
                properties: {
                    success: { type: "boolean", example: true },
                    message: {
                        type: "string",
                        example:
                            'Company "Tech Innovations Inc." and all related data deleted successfully',
                    },
                },
            },
        }),
        ApiResponse({ status: 401, description: "Unauthorized" }),
        ApiResponse({ status: 404, description: "Company not found" }),
        ApiResponse({ status: 500, description: "Failed to delete company" }),
    )
}
