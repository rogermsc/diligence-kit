import { Injectable, Inject } from "@nestjs/common"
import { FileReaderService } from "../../domain/interfaces/file-reader.interface"
import { StorageService } from "@/shared/services/storage.service"

@Injectable()
export class StorageFileReaderAdapter implements FileReaderService {
    constructor(
        @Inject("StorageService")
        private readonly storageService: StorageService,
    ) {}

    async readFileContent(filePath: string): Promise<string> {
        const fileBuffer = await this.storageService.downloadFile(filePath)
        return fileBuffer.toString("utf-8")
    }
}
