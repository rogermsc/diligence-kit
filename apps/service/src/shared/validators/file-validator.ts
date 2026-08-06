import { File as MulterFile } from "multer"
import { OnePagerValidationError } from "@/features/automation/start-automation/domain/errors/automation-errors"

export class FileValidator {
    static validateOnePagerFile(file: MulterFile): void {
        if (!file) {
            throw new OnePagerValidationError("File is required")
        }

        if (!file.originalname) {
            throw new OnePagerValidationError("File must have a valid name")
        }

        const hasValidExtension = file.originalname
            .toLowerCase()
            .endsWith(".md")

        if (!hasValidExtension) {
            throw new OnePagerValidationError(
                "One pager file must be a .md file",
            )
        }
    }
}
