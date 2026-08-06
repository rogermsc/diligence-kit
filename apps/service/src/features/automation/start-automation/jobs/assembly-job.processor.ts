import { Injectable, Logger, Inject } from "@nestjs/common"
import { Process, Processor } from "@nestjs/bull"
import { Job } from "bull"
import { UploadReadyForAssemblyEvent } from "../domain/events/automation.events"
import { UploadReadyForAssemblyEventSchema } from "../domain/events/automation.event-schemas"

import { EnhancedAssemblyCoordinatorService } from "../services/enhanced-assembly-coordinator.service"
import { AutomationStatusUpdaterService } from "../services/automation-status-updater.service"
import { EventBusPort } from "@/shared/domain/interfaces/event-bus.interface"
import { CompanyRepository } from "@/shared/repository/company-repository.interface"
import { StorageService } from "@/shared/services/storage.service"
import { ZipParserService } from "@/shared/services/zip-parser.service"
import { AutomationZipValidationError } from "../domain/errors/automation-errors"
import { File as DomainFile } from "@/shared/domain/entities/file.entity"

@Injectable()
@Processor("assembly-queue")
export class AssemblyJobProcessor {
    private readonly logger = new Logger(AssemblyJobProcessor.name)

    constructor(
        private readonly enhancedAssemblyCoordinator: EnhancedAssemblyCoordinatorService,
        private readonly automationStatusUpdater: AutomationStatusUpdaterService,
        @Inject("CompanyRepository")
        private readonly companyRepository: CompanyRepository,
        @Inject("StorageService")
        private readonly storageService: StorageService,
        @Inject("ZipParserService")
        private readonly zipParserService: ZipParserService,
        @Inject("EventBusPort")
        private readonly eventBus: EventBusPort,
    ) {}

    @Process("upload.ready.for.assembly")
    async handleUploadReadyForAssembly(
        job: Job<UploadReadyForAssemblyEvent>,
    ): Promise<void> {
        const {
            uploadId,
            totalChunks,
            confirmedChunks,
            originalFilename,
            companyId,
            companyName,
            automationId,
        } = UploadReadyForAssemblyEventSchema.parse(job.data)

        this.logger.log("Starting assembly process", {
            uploadId,
            totalChunks,
            confirmedChunksCount: confirmedChunks.length,
            originalFilename,
            automationId,
        })

        try {
            // Busca nome da empresa se não fornecido
            let finalCompanyName = companyName

            const companyNameNotProvided = !finalCompanyName

            const isNecessaryToGetCompanyName =
                companyNameNotProvided && companyId

            if (isNecessaryToGetCompanyName) {
                // Background job: no calling user to scope against.
                const company =
                    await this.companyRepository.findByIdAsSystem(companyId)
                finalCompanyName = company?.name || "Unknown"
            }

            const assemblyResult =
                await this.enhancedAssemblyCoordinator.startEnhancedAssembly(
                    uploadId,
                    totalChunks,
                    originalFilename,
                )

            if (!assemblyResult.success) {
                throw new Error(`Assembly failed: ${assemblyResult.error}`)
            }

            // Parse do ZIP para estrutura de árvore e upload otimizado em batch
            const uploadedFiles = await this.parseAndUploadZipFiles(
                assemblyResult.assembledFile,
                automationId,
                companyId,
            )

            await this.eventBus.emit("zip.assembled", {
                automationId,
                companyId,
                companyName: finalCompanyName,
                zipFile: {
                    originalname: assemblyResult.assembledFile.originalname,
                    mimetype: assemblyResult.assembledFile.mimetype,
                    size: assemblyResult.assembledFile.size,
                    // Sem buffer - arquivos já estão no bucket organizados
                    buffer: undefined,
                    encoding: assemblyResult.assembledFile.encoding,
                    fieldname: assemblyResult.assembledFile.fieldname,
                    // Metadados dos arquivos processados
                    uploadedFiles: uploadedFiles,
                    totalFiles: uploadedFiles.length,
                } as any,
                timestamp: new Date(),
            })

            this.logger.log("Assembly completed successfully", {
                uploadId,
                originalFilename,
                zipSize: assemblyResult.assembledFile.size,
                totalFilesExtracted: uploadedFiles.length,
                companyName: finalCompanyName,
            })
        } catch (error) {
            this.logger.error(`Assembly failed for upload ${uploadId}:`, error)

            const isAutomationZipValidationError =
                error instanceof AutomationZipValidationError

            if (isAutomationZipValidationError) {
                await this.automationStatusUpdater.markAsFailed(
                    automationId,
                    `ZIP validation failed: ${error.message}`,
                )

                this.logger.log(
                    `Automation marked as failed due to ZIP validation`,
                    {
                        automationId,
                        uploadId,
                        reason: error.message,
                    },
                )

                return // Return without throwing error to avoid retry in queue
            }

            throw error
        }
    }

    /**
     * Parse ZIP usando yauzl e upload otimizado dos arquivos individuais
     */
    private async parseAndUploadZipFiles(
        zipFile: any,
        automationId: string,
        // The company id, not its name — see UploadDocumentUseCase for why.
        companyId: string,
    ): Promise<any[]> {
        try {
            this.logger.log("Starting ZIP parsing and batch upload", {
                automationId,
                zipSize: zipFile.size,
                zipName: zipFile.originalname,
            })

            // 1. Parse ZIP para estrutura de árvore.
            //
            // The root folder name becomes the storage prefix, and it has to
            // carry the automation id. Without it two runs for the same company
            // write to the same keys — the second overwrites the first, and
            // earlier automations' bucketPath rows start resolving to newer
            // bytes. It also breaks documentNameFrom, which recovers a
            // document's path within the dataroom by looking for the id, so
            // 2023/financials.pdf and 2024/financials.pdf collapsed to one row.
            const rootFolder = await this.zipParserService.parseZipToFolder(
                zipFile.buffer,
                `${companyId}/${automationId}`,
            )

            this.logger.log("ZIP parsed successfully", {
                automationId,
                rootFolderName: rootFolder.getName(),
                totalChildren: rootFolder.getChildren().length,
            })

            // 2. Upload otimizado em batch para o bucket
            const uploadedFiles =
                await this.storageService.uploadFolderOnEnterpriseRoot(
                    `${companyId}/${automationId}`,
                    rootFolder,
                )

            this.logger.log("Batch upload completed", {
                automationId,
                totalFilesUploaded: uploadedFiles.length,
                companyId,
            })

            return uploadedFiles
        } catch (error) {
            this.logger.error("Failed to parse and upload ZIP files", {
                automationId,
                error: error.message,
                zipName: zipFile.originalname,
            })
            throw error
        }
    }
}
