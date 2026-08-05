import { File as MulterFile } from "multer"
import { RequestValidator } from "@/shared/validators/request-validator"
import { uploadDataroomSchema } from "../data/dtos/upload-dataroom.schema"
import { normalizeDataroomFiles } from "./normalize-files.helper"

const REQUIRED_FIELDS = [
    "company_information",
    "legal_and_intellectual_property",
    "financial_information",
    "product_information",
    "sales_performance",
    "business_and_marketing_deck",
    "investment_information",
]

export class FilesValidationHelper {
    static normalizeAndValidateFiles(
        enterpriseName: string,
        files: Record<string, MulterFile[]>,
    ): Record<string, MulterFile[]> {
        const normalizedFiles = normalizeDataroomFiles(files, REQUIRED_FIELDS)
        RequestValidator.validateOrThrow(
            { enterpriseName, files: normalizedFiles },
            uploadDataroomSchema,
        )
        return normalizedFiles
    }

    static getRequiredFields(): string[] {
        return [...REQUIRED_FIELDS]
    }

    static getDataroomFieldOptions() {
        return REQUIRED_FIELDS.map((name) => ({ name, maxCount: 1 }))
    }
}
