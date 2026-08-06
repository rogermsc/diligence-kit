import { Injectable, Inject, Logger } from "@nestjs/common"
import { Usecase } from "@/shared/interfaces/usecase"
import { StorageService, UploadedFile } from "@/shared/services/storage.service"
import { File as DomainFile } from "@/shared/domain/entities/file.entity"
import { GetCompanyByIdUseCase } from "./get-company-by-id.usecase"

const ALLOWED_EXTENSIONS = [
    ".pdf",
    ".csv",
    ".xls",
    ".xlsx",
    ".doc",
    ".docx",
    ".txt",
    ".ppt",
    ".pptx",
    ".png",
    ".jpg",
    ".jpeg",
    ".tiff",
    ".tif",
    ".bmp",
    ".webp",
]

export interface UploadDocumentInput {
    automationId: string
    companyId: string
    file: {
        originalname: string
        mimetype: string
        size: number
        buffer: Buffer
    }
}

export interface UploadDocumentOutput {
    fileName: string
    gcsPath: string
}

@Injectable()
export class UploadDocumentUseCase implements Usecase<
    UploadDocumentInput,
    UploadDocumentOutput
> {
    private readonly logger = new Logger(UploadDocumentUseCase.name)

    constructor(
        private readonly getCompanyByIdUseCase: GetCompanyByIdUseCase,
        @Inject("StorageService")
        private readonly storageService: StorageService,
    ) {}

    async execute(input: UploadDocumentInput): Promise<UploadDocumentOutput> {
        const { automationId, companyId, file } = input

        const { company } = await this.getCompanyByIdUseCase.execute({
            companyId,
        })

        const basename = file.originalname.split("/").pop() || file.originalname
        if (basename.startsWith("._")) {
            throw new Error(
                `macOS resource fork files are not allowed: "${basename}"`,
            )
        }

        const ext = this.getExtension(file.originalname)
        if (!ALLOWED_EXTENSIONS.includes(ext)) {
            throw new Error(
                `File extension "${ext}" is not allowed. Allowed: ${ALLOWED_EXTENSIONS.join(", ")}`,
            )
        }

        const domainFile = new DomainFile(
            file.originalname,
            file.size,
            file.mimetype,
            file.buffer,
        )

        const uploaded: UploadedFile =
            await this.storageService.uploadSingleFile(
                company.name,
                domainFile,
                automationId,
            )

        this.logger.log(
            `Uploaded "${file.originalname}" to ${uploaded.url} for automation ${automationId}`,
        )

        return {
            fileName: file.originalname,
            gcsPath: uploaded.url,
        }
    }

    private getExtension(filename: string): string {
        const dotIndex = filename.lastIndexOf(".")
        if (dotIndex === -1) return ""
        return filename.substring(dotIndex).toLowerCase()
    }
}
