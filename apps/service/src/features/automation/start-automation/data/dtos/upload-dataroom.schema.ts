import z from "zod"

const allowedMimeTypes = [
    "application/pdf",
    "text/csv",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "image/png",
    "image/jpeg",
    "image/tiff",
    "image/bmp",
    "image/webp",
]

const fileSchema = z.object({
    originalname: z.string(),
    mimetype: z.string().refine((val) => allowedMimeTypes.includes(val), {
        message: "Unsupported file type",
    }),
    buffer: z.instanceof(Buffer),
    size: z.number(),
})

export const uploadDataroomSchema = z.object({
    enterpriseName: z.string().min(1, "Enterprise name is required"),
    files: z.object({
        company_information: z
            .array(fileSchema)
            .min(1, "company_information is required and must be a file")
            .max(1, "Only one file allowed for company_information"),
        legal_and_intellectual_property: z
            .array(fileSchema)
            .min(
                1,
                "legal_and_intellectual_property is required and must be a file",
            )
            .max(
                1,
                "Only one file allowed for legal_and_intellectual_property",
            ),
        financial_information: z
            .array(fileSchema)
            .min(1, "financial_information is required and must be a file")
            .max(1, "Only one file allowed for financial_information"),
        product_information: z
            .array(fileSchema)
            .min(1, "product_information is required and must be a file")
            .max(1, "Only one file allowed for product_information"),
        sales_performance: z
            .array(fileSchema)
            .min(1, "sales_performance is required and must be a file")
            .max(1, "Only one file allowed for sales_performance"),
        business_and_marketing_deck: z
            .array(fileSchema)
            .min(
                1,
                "business_and_marketing_deck is required and must be a file",
            )
            .max(1, "Only one file allowed for business_and_marketing_deck"),
        investment_information: z
            .array(fileSchema)
            .min(1, "investment_information is required and must be a file")
            .max(1, "Only one file allowed for investment_information"),
    }),
})

export function validateUploadDataroomSchema(input: any) {
    return uploadDataroomSchema.parse(input)
}
