import { File } from "@/shared/domain/entities/file.entity"

export interface UploadedFile {
    url: string
    path: string
    name: string
}

export interface StorageService {
    uploadSingleFile(
        path: string,
        file: File,
        subPath?: string,
    ): Promise<UploadedFile>
    downloadFile(filePath: string): Promise<Buffer>
}
