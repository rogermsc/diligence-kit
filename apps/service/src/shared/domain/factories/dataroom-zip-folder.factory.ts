import { Folder } from "@/shared/domain/entities/file.entity"
import { ZipParserService } from "@/shared/services/zip-parser.service"
import { Logger } from "@nestjs/common"

export class DataroomZipFolderFactory {
    constructor(private readonly zipParserService: ZipParserService) {}

    async createFromZipBuffer(
        enterpriseName: string,
        zipBuffer: Buffer,
    ): Promise<Folder> {
        Logger.debug("Creating folder from zip buffer", {
            enterpriseName,
            zipBuffer,
        })

        const normalizedEnterpriseName = this.normalizeName(enterpriseName)
        return await this.zipParserService.parseZipToFolder(
            zipBuffer,
            normalizedEnterpriseName,
        )
    }

    private normalizeName(name: string): string {
        return name.trim().toLowerCase().replace(/\s+/g, "_")
    }
}
