import { File as MulterFile } from "multer"
import { AutomationUploadUseCase } from "../use-case/automation-upload.usecase"
import { AutomationZipUploadUseCase } from "../use-case/automation-zip-upload.usecase"
import { AutomationUploadFailedError } from "../domain/errors/automation-errors"
import { Logger } from "@nestjs/common"

export class UploadHelper {
    static async uploadDocuments(
        uploadUseCase: AutomationUploadUseCase,
        enterpriseName: string,
        files: Record<string, MulterFile[]>,
    ) {
        try {
            const uploadResult = await uploadUseCase.execute({
                enterpriseName,
                files,
            })
            return {
                documents: uploadResult.documents,
                uploadedFiles: uploadResult.uploadedFiles,
            }
        } catch (err) {
            throw new AutomationUploadFailedError()
        }
    }

    static async uploadZipDocuments(
        zipUploadUseCase: AutomationZipUploadUseCase,
        enterpriseName: string,
        automationId: string,
        zipFile: MulterFile,
    ) {
        try {
            const uploadResult = await zipUploadUseCase.execute({
                enterpriseName,
                automationId,
                zipFile,
            })
            return {
                documents: uploadResult.documents,
                uploadedFiles: uploadResult.uploadedFiles,
            }
        } catch (err) {
            Logger.error('Error uploading ZIP documents', err);

            // Re-throw validation errors to preserve specific error messages
            if (err.message?.includes('ZIP file is empty') ||
                err.message?.includes('Invalid file type')) {
                throw err;
            }

            throw new AutomationUploadFailedError()
        }
    }
}
