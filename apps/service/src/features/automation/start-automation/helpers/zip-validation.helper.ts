import { File as MulterFile } from "multer"
import { RequestValidator } from "@/shared/validators/request-validator"
import { uploadZipDataroomSchema } from "../data/dtos/upload-zip-dataroom.schema"
import { AutomationZipValidationError } from "../domain/errors/automation-errors"

export class ZipValidationHelper {
    static validateZipFile(enterpriseId: string, file: MulterFile): MulterFile {
        const isFileProvided = file !== undefined && file !== null

        if (!isFileProvided) {
            throw new AutomationZipValidationError("No file was provided")
        }

        const isValidZipFile = this.isZipFile(file)

        if (!isValidZipFile) {
            throw new AutomationZipValidationError("File must be a valid ZIP")
        }

        try {
            uploadZipDataroomSchema.parse({ enterpriseId, file })
        } catch (error) {
            if (error && typeof error === "object" && "issues" in error) {
                //Improve this
                const zodError = error
                const firstIssue = zodError.issues?.[0]
                if (firstIssue) {
                    throw new AutomationZipValidationError(firstIssue.message)
                }
            }
            const errorMessage =
                error instanceof Error ? error.message : "Invalid ZIP file data"
            throw new AutomationZipValidationError(errorMessage)
        }

        return file
    }

    private static isZipFile(file: MulterFile): boolean {
        const zipMimeTypes = [
            "application/zip",
            "application/x-zip-compressed",
            "multipart/x-zip",
        ]

        const hasZipMimeType = zipMimeTypes.includes(file.mimetype)
        const hasZipExtension = file.originalname.toLowerCase().endsWith(".zip")

        return hasZipMimeType || hasZipExtension
    }
}
